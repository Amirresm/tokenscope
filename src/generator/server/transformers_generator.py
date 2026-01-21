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
        model_dirs.sort(key=lambda x: x["id"])
        return model_dirs

    def __init__(
        self,
        model: ModelWrapper,
        default_max_tokens=50,
        topp=1,
        force_greedy=False,
        thr=0.75,
        stop_tokens=[],
    ):
        self.model = model
        self.default_max_tokens = default_max_tokens
        self.max_tokens = default_max_tokens

        self.stop_tokens = stop_tokens
        self.device = self.model.m.device

        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []

    def reset(self):
        self.prompt = None
        self.max_tokens = self.default_max_tokens
        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []
        self.model.reset()

    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens: list[list[Token]] | None = None,
        max_tokens=None,
        topk=1,
        topp=0,
        coeff=1.0,
        alternatives=5,
        record_attention: bool = False,
        attention_layer=-1,
        attention_top_n=10,
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

        if self.model.device == "cuda":
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
                        topk=topk,
                        topp=topp,
                        coeff=coeff,
                        alternatives=alternatives,
                        attention_layer=attention_layer,
                        attention_top_n=attention_top_n,
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

        if self.model.device == "cuda":
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
            add_special_tokens=False,
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
                    if isinstance(control_type, ControlTokenTypes):
                        if control_type == ControlTokenTypes.EOS:
                            tags.append(ControlTokenTypes.PAD.name.lower())
                        else:
                            tags.append(control_type.name.lower())
                    else:
                        tags.append(control_type)

                perplexity = None
                if calc_perplexity:
                    single_input_ids = input_ids[i : i + 1, : j + 1]
                    perplexity, last_perplexity = (
                        self._call_model_and_calculate_perplexity(
                            single_input_ids,
                            torch.ones_like(single_input_ids),
                        )
                    )

                prompt_step_result = Token(
                    position=j,
                    token_time_ms=0,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    perplexity=perplexity,
                    last_perplexity=last_perplexity,
                    margin_confidence=None,
                    entropy=None,
                    alternative_tokens=[],
                    token_types=list(set(tags)),
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
                    if isinstance(control_type, ControlTokenTypes):
                        if control_type == ControlTokenTypes.EOS:
                            tags.append(ControlTokenTypes.PAD.name.lower())
                        else:
                            tags.append(control_type.name.lower())
                    else:
                        tags.append(control_type)

                perplexity = None
                if calc_perplexity:
                    single_input_ids = input_ids[i : i + 1, : j + 1]
                    single_attention_mask = attention_mask[i : i + 1, : j + 1]
                    perplexity, last_perplexity = (
                        self._call_model_and_calculate_perplexity(
                            single_input_ids, single_attention_mask
                        )
                    )

                prompt_step_result = Token(
                    position=j,
                    token_time_ms=0,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    perplexity=perplexity,
                    last_perplexity=last_perplexity,
                    margin_confidence=None,
                    entropy=None,
                    alternative_tokens=[],
                    token_types=list(set(tags)),
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
        batch_size: int,
        past_key_values,
        record_attention: bool,
        topk: int,
        topp: int,
        coeff: float,
        alternatives: int,
        attention_layer: int,
        attention_top_n: int,
        index: int,
    ):
        model_start_time = time.perf_counter_ns()
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
        model_duration = time.perf_counter_ns() - model_start_time

        logits = output.logits
        perplexity, last_perplexity = self._calculate_perplexity(
            logits, input_ids, attention_mask
        )

        results, new_ids = self._process_logits(
            logits,
            batch_size,
            topk=topk,
            topp=topp,
            coeff=coeff,
            alternatives=alternatives,
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
            attention_results = self.record_attentions(
                output.attentions,
                attn_layer=attention_layer,
                attn_top_n=attention_top_n,
            )

        step_tokens = []
        for batch_index, result in enumerate(results):
            (
                token_id,
                confidence,
                margin_confidence,
                entropy,
                all_token_ids,
                all_confidences,
            ) = result
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

            control_type = self.model.get_control_token_type(decoded_token)
            if control_type is not None:
                token_types.append("special")
                if isinstance(control_type, ControlTokenTypes):
                    if control_type == ControlTokenTypes.EOS:
                        token_types.append(ControlTokenTypes.PAD.name.lower())
                    else:
                        token_types.append(control_type.name.lower())
                else:
                    token_types.append(control_type)

            attention_snapshot = (
                attention_results[batch_index] if attention_results else None
            )

            step_result = Token(
                position=index,
                token_time_ms=model_duration / 1e6,
                token_string=decoded_token,
                token_id=token_id,
                confidence=confidence,
                perplexity=perplexity,
                last_perplexity=last_perplexity,
                margin_confidence=margin_confidence,
                entropy=entropy,
                token_types=list(set(token_types)),
                alternative_tokens=[
                    Token(
                        position=-1,
                        token_time_ms=model_duration / 1e6,
                        token_string=self.model.ids_to_str(tok_id),
                        token_id=tok_id,
                        confidence=conf,
                        perplexity=None,
                        last_perplexity=None,
                        margin_confidence=None,
                        entropy=None,
                        token_types=[],
                    )
                    for tok_id, conf in zip(all_token_ids, all_confidences)
                ],
                attention_snapshot=attention_snapshot,
            )
            should_stop = self._check_stop_token(step_result)
            step_tokens.append((step_result, should_stop))

        return step_tokens, input_ids, attention_mask, output.past_key_values

    def _calculate_perplexity(self, logits, target_ids, attention_mask):
        batch_size, seq_len = target_ids.shape
        device = logits.device

        if seq_len > 1:
            shift_logits = logits[:, :-1, :].contiguous()
            shift_labels = target_ids[:, 1:].contiguous()
            shift_mask = attention_mask[:, 1:].contiguous()

            if self.model.t.pad_token_id is not None and isinstance(
                self.model.t.pad_token_id, str
            ):
                pad_token_id = int(self.model.t.pad_token_id)
            else:
                pad_token_id = -100

            loss_fct = torch.nn.CrossEntropyLoss(
                reduction="none",
                ignore_index=pad_token_id,
            )

            loss = loss_fct(
                shift_logits.view(-1, shift_logits.size(-1)),
                shift_labels.view(-1),
            ).view(shift_labels.size())

            loss = loss * shift_mask

            lengths = shift_mask.sum(dim=1)

            # sequence perplexity
            seq_ppl = torch.exp(loss.sum(dim=1) / lengths)

            # last valid token perplexity
            last_token_idx = lengths.long() - 1
            batch_idx = torch.arange(batch_size, device=device)
            last_token_nll = loss[batch_idx, last_token_idx]
            token_ppl = torch.exp(last_token_nll)

            return (
                float(seq_ppl.mean().detach().cpu().float().item()),
                float(last_token_nll.mean().detach().cpu().float().item()),
            )

        else:
            # Only token-level surprisal is defined
            logits_t = logits[:, -1, :]  # (batch, vocab)
            log_probs = torch.log_softmax(logits_t, dim=-1)

            token_id = target_ids[:, 0]
            nll = -log_probs.gather(1, token_id.unsqueeze(1)).squeeze(1)
            token_ppl = torch.exp(nll)

            return (
                0,  # sequence perplexity undefined
                float(nll.mean().detach().cpu().float().item()),
            )

    def _call_model_and_calculate_perplexity(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
    ):
        with torch.no_grad():
            output = self.model.m(
                input_ids=input_ids,
                attention_mask=attention_mask,
            )
            logits = output.logits

        perplexity, last_perplexity = self._calculate_perplexity(
            logits, input_ids, attention_mask
        )
        return perplexity, last_perplexity

    def _process_logits(
        self,
        logits: torch.Tensor,
        batch_size: int,
        alternatives: int,
        topk: int,
        topp: int,
        coeff: float,
    ) -> tuple[
        list[tuple[int, float, float, float, list[int], list[float]]],
        torch.Tensor,
    ]:

        new_ids = torch.zeros(
            (batch_size, 1), dtype=torch.int64, device=self.device
        )

        # temperature scaling (coeff = 1 / temperature)
        logits = logits[:, -1, :]  # (batch_size, vocab)
        scaled_logits = logits * coeff  # (batch_size, vocab)

        # original distribution
        orig_probs = torch.softmax(logits, dim=-1)

        # full distribution (for confidence metrics)
        full_probs = torch.softmax(scaled_logits, dim=-1)

        # top-k sampling distribution
        topk_logits, topk_indices = torch.topk(scaled_logits, topk, dim=-1)
        topk_probs = torch.softmax(topk_logits, dim=-1)

        # alternatives (debug)
        at_probs, at_indices = torch.topk(orig_probs, alternatives, dim=-1)

        # move to cpu once
        orig_probs = orig_probs.detach().cpu().to(torch.float32).numpy()
        full_probs = full_probs.detach().cpu().to(torch.float32).numpy()
        topk_probs = topk_probs.detach().cpu().to(torch.float32).numpy()
        topk_indices = topk_indices.detach().cpu().numpy()
        at_probs = at_probs.detach().cpu().to(torch.float32).numpy()
        at_indices = at_indices.detach().cpu().numpy()

        results = []

        for i in range(batch_size):
            p = topk_probs[i]
            idx = topk_indices[i]

            # --- true nucleus (top-p) filtering ---
            if topp < 1.0:
                order = np.argsort(-p)
                p_sorted = p[order]
                idx_sorted = idx[order]

                cumulative = np.cumsum(p_sorted)
                cutoff = cumulative <= topp
                if not np.any(cutoff):
                    cutoff[0] = True

                p = p_sorted[cutoff]
                idx = idx_sorted[cutoff]
                p = p / p.sum()
            else:
                p = p / p.sum()

            # sampling
            if topp == 0 or len(p) == 1:
                chosen = 0
            else:
                chosen = np.random.choice(len(p), p=p)

            token_id = int(idx[chosen])
            new_ids[i, 0] = token_id

            # ---------- confidence metrics ----------
            fp = orig_probs[i]

            # 1) true model confidence
            confidence = float(fp[token_id])

            # 2) margin confidence (top-1 - top-2)
            top2 = np.partition(fp, -2)[-2:]
            margin_confidence = float(top2[1] - top2[0])

            # 3) entropy
            entropy = float(-np.sum(fp * np.log(fp + 1e-12)))

            # alternatives (normalized for readability)
            # at_p = at_probs[i]
            # at_p = at_p / at_p.sum()

            results.append(
                (
                    token_id,
                    confidence,
                    margin_confidence,
                    entropy,
                    at_indices[i].tolist(),
                    at_probs[i].tolist(),
                )
            )

        return results, new_ids

    def record_attentions(
        self, attention: tuple[torch.Tensor], attn_layer=-1, attn_top_n=10
    ):
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

    def _log_metrics(self, elapsed, token_count):
        print(
            f"Generated {token_count} tokens in {elapsed:.3f} secs ({token_count/elapsed:.2f}tps)."
        )
        print("\n", "=" * 80)

    def _check_stop_token(self, token: Token):
        ttype = self.model.get_control_token_type(token.token_string)
        if (
            ttype in self.stop_tokens
            or token in self.stop_tokens
            or "stop" in token.token_types
            or ttype == ControlTokenTypes.EOS
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
