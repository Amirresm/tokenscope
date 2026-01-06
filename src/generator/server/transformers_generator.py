import os
from dataclasses import dataclass
import typing

import numpy as np
import torch
import time

from src.generator.generator import Generator
from src.generator.token_node import Token
from src.model.wrapper import ControlTokenTypes, ModelWrapper


@dataclass
class GeneratorItem:
    token: Token
    stop: bool
    fresh: bool


class BatchGenerator(Generator):
    @staticmethod
    def get_available_models(
        models_directory="/storage/c/ai/models/llm",
    ):
        model_dirs = []
        for root, _, files in os.walk(models_directory):
            if "config.json" in files and "tokenizer_config.json" in files:
                model_dirs.append(root)
        model_dirs = [{"id": d, "metadata": {}} for d in model_dirs]
        return model_dirs

    def __init__(
        self,
        model: ModelWrapper,
        default_max_tokens=50,
        topk=1,
        force_greedy=False,
        thr=0.75,
        stop_tokens=[],
    ):
        self.model = model
        self.default_max_tokens = default_max_tokens
        self.max_tokens = default_max_tokens
        self.topk = topk
        self.force_greedy = force_greedy
        self.thr = thr
        self.stop_tokens = stop_tokens
        self.device = self.model.m.device
        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []
        self.generation_results: list[Token] = []

    def reset(self):
        self.prompt = None
        self.max_tokens = self.default_max_tokens
        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []
        self.generation_results = []
        self.model.reset()

    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens: list[list[Token]] | None = None,
        max_tokens=None,
        record_attention: bool = False,
        log_metric=False,
    ) -> typing.Generator[list[GeneratorItem], None, None]:
        old_padding_side = self.model.t.padding_side
        self.model.t.padding_side = "left"
        self.max_tokens = max_tokens or self.default_max_tokens

        if prompts_tokens is not None:
            batch_size = len(prompts_tokens)
            stop_status = [False] * batch_size

            generation_results, input_ids, attention_mask = (
                self._prepare_prompts_from_tokens(prompts_tokens)
            )
        else:
            if isinstance(prompts, str):
                prompts = [prompts]
            batch_size = len(prompts)
            stop_status = [False] * batch_size

            generation_results, input_ids, attention_mask = (
                self._prepare_prompts(prompts)
            )

        for i in range(input_ids.shape[1]):
            step_result = [
                GeneratorItem(p[i], False, False) for p in generation_results
            ]
            yield step_result

        remaining_token_count = self.max_tokens
        generation_step_count = 0
        past_key_values = None

        memory_before = torch.cuda.memory_allocated(self.device)
        start_time = time.time()
        with torch.no_grad():
            for i in range(remaining_token_count):
                generation_step_count += 1
                step_tokens, input_ids, attention_mask, next_past_key_values = (
                    self._loop(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        batch_size=batch_size,
                        past_key_values=past_key_values,
                        record_attention=record_attention,
                        index=i + input_ids.shape[1],
                    )
                )
                if not record_attention:
                    past_key_values = next_past_key_values

                stop_status = [
                    ss or st[1] for st, ss in zip(step_tokens, stop_status)
                ]
                yield [
                    GeneratorItem(st[0], ss, True)
                    for st, ss in zip(step_tokens, stop_status)
                ]

                if all(stop_status):
                    print("All stop tokens reached, stopping generation.")
                    break
        elapsed = time.time() - start_time
        self.time_history.append(elapsed)

        max_memory = torch.cuda.max_memory_allocated(self.device)
        self.memory_history.append(max_memory)
        print(
            f"Memory usage: {memory_before / 1024**2:.2f} MB -> {max_memory / 1024**2:.2f} MB"
        )
        self.num_sample_history.append(batch_size)

        if generation_step_count == remaining_token_count:
            print(
                f"Reached max tokens limit ({self.max_tokens}), stopping generation."
            )

        if log_metric:
            token_count = input_ids.shape[0] * generation_step_count
            self._log_metrics(elapsed, token_count)

        self.model.t.padding_side = old_padding_side

    def prompts_to_token(self, prompts: list[str], calc_perplexity=True):
        tokenized = self.model.t(
            prompts,
            padding="longest",
            max_length=512,
            return_tensors="pt",
        ).to(self.device)
        input_ids: torch.Tensor = tokenized.input_ids

        generation_results: list[list[Token]] = [
            [] for _ in range(len(prompts))
        ]

        for j in range(input_ids.shape[1]):
            tokens = self.model.t.batch_decode(input_ids[:, j])
            for i in range(input_ids.shape[0]):
                token_id = int(input_ids[i, j].item())
                token = tokens[i]

                tags = []

                control_type = self.model.get_control_token_type(token)
                if control_type is not None:
                    tags.append("special")
                    if control_type == ControlTokenTypes.EOS:
                        tags.append(ControlTokenTypes.PAD.name.lower())
                    else:
                        tags.append(control_type.name.lower())

                perplexity = None
                if calc_perplexity:
                    single_input_ids = input_ids[i : i + 1, : j + 1]
                    perplexity = self._call_model_and_calculate_perplexity(
                        single_input_ids,
                        torch.ones_like(single_input_ids),
                    )

                prompt_step_result = Token(
                    position=j,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    perplexity=perplexity,
                    alternative_tokens=[],
                    token_types=tags,
                )

                generation_results[i].append(prompt_step_result)

        return generation_results

    def _prepare_prompts(self, prompts: list[str], calc_perplexity=True):
        tokenized = self.model.t(
            prompts,
            padding="longest",
            max_length=512,
            return_tensors="pt",
        ).to(self.device)
        input_ids: torch.Tensor = tokenized.input_ids
        attention_mask: torch.Tensor = tokenized.attention_mask

        generation_results: list[list[Token]] = [
            [] for _ in range(input_ids.shape[0])
        ]

        for j in range(input_ids.shape[1]):
            tokens = self.model.t.batch_decode(input_ids[:, j])
            for i in range(input_ids.shape[0]):
                token_id = int(input_ids[i, j].item())
                token = tokens[i]

                control_type = self.model.get_control_token_type(token)
                tags = ["prompt"]
                if control_type is not None:
                    tags.append("special")
                    if control_type == ControlTokenTypes.EOS:
                        tags.append(ControlTokenTypes.PAD.name.lower())
                    else:
                        tags.append(control_type.name.lower())

                perplexity = None
                if calc_perplexity:
                    single_input_ids = input_ids[i : i + 1, : j + 1]
                    single_attention_mask = attention_mask[i : i + 1, : j + 1]
                    perplexity = self._call_model_and_calculate_perplexity(
                        single_input_ids, single_attention_mask
                    )

                prompt_step_result = Token(
                    position=j,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    perplexity=perplexity,
                    alternative_tokens=[],
                    token_types=tags,
                )

                generation_results[i].append(prompt_step_result)

        return generation_results, input_ids, attention_mask

    def _prepare_prompts_from_tokens(self, prompts: list[list[Token]]):
        input_ids_list = [
            [step.token_id for step in prompt] for prompt in prompts
        ]
        input_ids = torch.tensor(
            input_ids_list, dtype=torch.int64, device=self.device
        )
        attention_mask = torch.ones(
            input_ids.shape, dtype=torch.int64, device=self.device
        )

        return prompts, input_ids, attention_mask

    def _loop(
        self,
        input_ids,
        attention_mask,
        batch_size,
        past_key_values,
        record_attention,
        index: int,
    ):
        if past_key_values is None or record_attention:
            output = self.model.m(
                input_ids=input_ids,
                attention_mask=attention_mask,
                output_attentions=record_attention,
            )
        else:
            output = self.model.m(
                input_ids=input_ids,
                attention_mask=attention_mask,
                past_key_values=past_key_values,
                use_cache=True,
            )
        logits = output.logits
        perplexity = self._calculate_perplexity(
            logits, input_ids, attention_mask
        )

        results, new_ids = self._process_logits(
            logits, batch_size, topn=self.topk, coeff=1
        )

        if record_attention:
            input_ids = torch.cat(
                [
                    input_ids,
                    new_ids,
                ],
                dim=1,
            )
        else:
            input_ids = new_ids
        attention_mask = torch.cat(
            [
                attention_mask,
                torch.ones((batch_size, 1), device=self.device),
            ],
            dim=1,
        )

        attention_results = None
        if record_attention and output.attentions is not None:
            attention_results = self.record_attentions(output.attentions)

        step_tokens = []
        for batch_index, result in enumerate(results):
            token_id, confidence, all_token_ids, all_confidences = result
            decoded_token = self.model.ids_to_str(token_id)

            token_types = []
            if decoded_token in self.model.t.all_special_tokens:
                token_types.append("special")
                if decoded_token == self.model.t.eos_token:
                    token_types.append("stop")
                if decoded_token == self.model.t.pad_token:
                    token_types.append("pad")
                if decoded_token == self.model.t.bos_token:
                    token_types.append("bos")

            attention_snapshot = (
                attention_results[batch_index] if attention_results else None
            )

            step_result = Token(
                position=index,
                token_string=decoded_token,
                token_id=token_id,
                confidence=confidence,
                perplexity=perplexity,
                token_types=token_types,
                alternative_tokens=[
                    Token(
                        position=-1,
                        token_string=self.model.ids_to_str(tok_id),
                        token_id=tok_id,
                        confidence=conf,
                        perplexity=None,
                        token_types=[],
                    )
                    for tok_id, conf in zip(all_token_ids, all_confidences)
                ],
                attention_snapshot=attention_snapshot,
            )
            should_stop = self._check_stop_token(decoded_token)
            step_tokens.append((step_result, should_stop))

        return step_tokens, input_ids, attention_mask, output.past_key_values

    def _calculate_perplexity(
        self, logits, target_ids, attention_mask
    ) -> float:
        shift_logits = logits[:, :-1, :].contiguous()
        shift_labels = target_ids[:, 1:].contiguous()
        shift_attention_mask = attention_mask[:, 1:].contiguous()

        if (
            self.model.t.pad_token is not None
            and type(self.model.t.pad_token) == str
        ):
            pad_token_id = int(self.model.t.pad_token_id)
        else:
            pad_token_id = -100

        loss_fct = torch.nn.CrossEntropyLoss(
            reduction="none", ignore_index=pad_token_id
        )
        loss = loss_fct(
            shift_logits.view(-1, shift_logits.size(-1)),
            shift_labels.view(-1),
        )
        loss = loss.view(shift_labels.size())

        masked_loss = loss * shift_attention_mask
        sum_loss = masked_loss.sum(dim=1)
        lengths = shift_attention_mask.sum(dim=1)

        perplexities = torch.exp(sum_loss / lengths)
        return float(perplexities.detach().cpu().to(torch.float32).mean().item())

    def _call_model_and_calculate_perplexity(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ) -> float:
        with torch.no_grad():
            output = self.model.m(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            logits = output.logits

        perplexity = self._calculate_perplexity(
            logits, input_ids, attention_mask
        )
        return perplexity

    def _process_logits(
        self,
        logits: torch.Tensor,
        batch_size: int,
        topn: int = 1,
        coeff: float = 1.0,
    ) -> tuple[list[tuple[int, float, list[int], list[float]]], torch.Tensor]:
        new_ids = torch.zeros(
            (batch_size, 1), dtype=torch.int64, device=self.device
        )
        logits = logits * coeff  # scale logits
        sf = torch.nn.functional.softmax(
            logits[:, -1, :], dim=-1
        )  # shape: (batch_size, vocab_size)

        probs, indices = torch.topk(
            sf, topn, dim=-1
        )  # shape: (batch_size, topn)
        probs = probs.detach().cpu().to(torch.float32).numpy()
        indices = indices.detach().cpu().numpy()

        results = []
        for i in range(batch_size):
            p = probs[i]
            idx = indices[i]
            p = p / p.sum()  # normalize
            if self.force_greedy:
                chosen_index = 0
            else:
                chosen_index = np.random.choice(topn, p=p)
            new_ids[i, 0] = idx[chosen_index]
            token_id = int(idx[chosen_index])
            confidence = float(p[chosen_index])

            results.append(
                (
                    token_id,
                    confidence,
                    typing.cast(list[int], idx.tolist()),
                    p.tolist(),
                )
            )

        return results, new_ids

    def record_attentions(self, attention: tuple[torch.Tensor]):
        attn_layer = -1
        attn_top_n = 10
        attn_layer = min(len(attention) - 1, attn_layer or 0)
        last_layer_attention = attention[attn_layer]  # (B, H, T, S)

        batch_size, num_heads, tgt_len, src_len = last_layer_attention.shape
        current_tok_index = tgt_len - 1  # last token per batch

        print(
            f"target len: {tgt_len}, source len: {src_len}, current idx: {current_tok_index}"
        )

        # Slice attention for last generated token across all heads
        # Shape: (B, H, S)
        attn_rows = last_layer_attention[:, :, current_tok_index, :]

        attn_top_n = min(attn_top_n, src_len)

        # Top-k for each head in each batch item: returns (B, H, K)
        top_vals, top_idxs = torch.topk(attn_rows, k=attn_top_n, dim=-1)

        attention_snapshots: list[dict[str, list[tuple[int, float]]]] = []

        for b in range(batch_size):
            # snapshot: list[list[tuple[int, float]]] = []
            snapshot: dict[str, list[tuple[int, float]]] = {}

            for h in range(num_heads):
                indices = top_idxs[b, h].tolist()
                values = top_vals[b, h].tolist()
                head_topk = list(zip(indices, values))
                # snapshot.append(head_topk)
                snapshot[f"head_{h}"] = head_topk

            # Mean attention across heads: (S,)
            mean_row = attn_rows[b].mean(dim=0)  # (S,)
            mean_top_vals, mean_top_idxs = torch.topk(mean_row, k=attn_top_n)
            mean_top = list(zip(mean_top_idxs.tolist(), mean_top_vals.tolist()))
            # snapshot.append(mean_top)
            snapshot["mean"] = mean_top

            attention_snapshots.append(snapshot)

        return attention_snapshots

    def generation_to_str(self, attach_prompt=True):
        generation = self.prompt if self.prompt and attach_prompt else ""
        for step_result in self.generation_results:
            generation += f"{step_result.token_string}"

        return generation

    def _log_metrics(self, elapsed, token_count):
        print(
            f"Generated {token_count} tokens in {elapsed:.3f} secs ({token_count/elapsed:.2f}tps)."
        )
        print("\n", "=" * 80)

    def _check_stop_token(self, token):
        ttype = self.model.get_control_token_type(token)
        if (
            ttype in self.stop_tokens
            or token in self.stop_tokens
            or self.model.get_control_token_type(token) == ControlTokenTypes.EOS
        ):
            return True
        return False

    def report_time(self):
        total_time = sum(self.time_history)
        total_samples = sum(self.num_sample_history)
        avg = total_time / total_samples if total_samples > 0 else 0

        print(f"Total time taken: {total_time:.2f} seconds")
        print(f"Average time per sample: {avg:.2f} seconds")

    def report_memory(self):
        avg = np.mean(self.memory_history) / 1024**2
        std = np.std(self.memory_history) / 1024**2

        print(f"Average memory usage: {avg:.2f} MB ± {std:.2f} MB")
