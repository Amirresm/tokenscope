from collections import defaultdict
import typing
import uuid

import numpy as np
import torch
import time

from src.generator.token_node import TokenNode, TokenType
from src.model.wrapper import (
    ControlTokenTypes,
    LlamaModelWrapper,
    ModelWrapper,
    QwenModelWrapper,
)

# @dataclass
# class StepResult:
#     index: int
#     token: str
#     token_id: int
#     confidence: float
#     all_tokens: list[str]
#     all_tokens_ids: list[int]
#     all_confidences: list[float]
#     tags: list[str]
#     stop: bool = False
#
#     attention_snapshot: list[list[tuple[int, float]]] | None = None
#
#     def to_dict(self):
#         attention_snapshot = (
#             [
#                 [[h[0], f"{h[1]:.3f}"] for h in head]
#                 for head in self.attention_snapshot
#             ]
#             if self.attention_snapshot
#             else None
#         )
#
#         return {
#             "index": self.index,
#             "token": self.token,
#             "token_id": self.token_id,
#             "confidence": self.confidence,
#             "all_tokens_ids": self.all_tokens_ids,
#             "all_tokens": self.all_tokens,
#             "all_confidences": self.all_confidences,
#             "tags": self.tags,
#             "stop": self.stop,
#             "attention_snapshot": attention_snapshot,
#         }
#
#     @staticmethod
#     def from_dict(json_obj):
#         base = StepResult(**json_obj)
#         return base


class BatchGenerator:
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
        max_tokens=None,
        record_attention: bool = False,
        log_metric=False,
    ) -> typing.Generator[list[tuple[TokenNode, bool]], None, None]:
        sample_id = uuid.uuid4().hex
        old_padding_side = self.model.t.padding_side
        self.model.t.padding_side = "left"
        self.max_tokens = max_tokens or self.default_max_tokens

        if isinstance(prompts, str):
            prompts = [prompts]

        batch_size = len(prompts)
        stop_status = [False] * batch_size

        generation_results, input_ids, attention_mask = self._prepare_prompts(
            prompts, sample_id=sample_id
        )
        for i in range(input_ids.shape[1]):
            step_result = [(p[i], False) for p in generation_results]
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
                yield [(st[0], ss) for st, ss in zip(step_tokens, stop_status)]

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

    def _prepare_prompts(self, prompts: list[str], sample_id: str):
        tokenized = self.model.t(
            prompts,
            padding="longest",
            max_length=512,
            return_tensors="pt",
        ).to(self.device)
        input_ids = tokenized.input_ids
        attention_mask = tokenized.attention_mask

        generation_results = [[] for _ in range(input_ids.shape[0])]
        root_token_node: TokenNode | None = None

        for j in range(input_ids.shape[1]):
            tokens = self.model.t.batch_decode(input_ids[:, j])
            for i in range(input_ids.shape[0]):
                token_id = input_ids[i, j].item()
                token = tokens[i]

                control_type = self.model.get_control_token_type(token)
                token_types = [TokenType.PROMPT]
                if control_type is not None:
                    token_types.append(TokenType.SPECIAL)
                    if control_type == ControlTokenTypes.EOS:
                        token_types.append(TokenType.STOP)
                    # else:
                    #     token_types.append(control_type.name.lower())

                token_node = TokenNode(
                    position=j,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    token_types=set(token_types),
                    sample_id=sample_id,
                )
                if root_token_node is None:
                    root_token_node = token_node

        return generation_results, input_ids, attention_mask

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
        for i, result in enumerate(results):
            token_id, confidence, all_token_ids, all_confidences = result
            decoded_token = self.model.ids_to_str(token_id)
            token_control_type = self.model.get_control_token_type(
                decoded_token
            )

            tags = []
            if token_control_type is not None:
                tags.append("special")
                tags.append(token_control_type.name.lower())

            step_result = StepResult(
                index=index,
                token=decoded_token,
                token_id=token_id,
                confidence=confidence,
                all_tokens_ids=all_token_ids,
                all_tokens=[
                    self.model.ids_to_str(tok_id) for tok_id in all_token_ids
                ],
                all_confidences=all_confidences,
                tags=tags,
                attention_snapshot=(
                    attention_results[i] if attention_results else None
                ),
            )
            should_stop = self._check_stop_token(decoded_token)
            step_tokens.append((step_result, should_stop))

        return step_tokens, input_ids, attention_mask, output.past_key_values

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

        attention_snapshots = []

        for b in range(batch_size):
            snapshot = []

            for h in range(num_heads):
                indices = top_idxs[b, h].tolist()
                values = top_vals[b, h].tolist()
                head_topk = list(zip(indices, values))
                snapshot.append(head_topk)

            # Mean attention across heads: (S,)
            mean_row = attn_rows[b].mean(dim=0)  # (S,)
            mean_top_vals, mean_top_idxs = torch.topk(mean_row, k=attn_top_n)
            mean_top = list(zip(mean_top_idxs.tolist(), mean_top_vals.tolist()))
            snapshot.append(mean_top)

            attention_snapshots.append(snapshot)

        return attention_snapshots

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


if __name__ == "__main__":
    from src.model.wrapper import ModelWrapper

    model_path = (
        # "/home/amirreza/projects/ai/models/llm/llama-3.2-3B-Instruct"
        # "/home/amirreza/projects/ai/models/llm/llama-3.2-3B"
        # "/home/amirreza/projects/ai/models/llm/Qwen2.5-Coder-7B"
        "/mnt/storage/ai/models/llm/Qwen/Qwen2.5-Coder-1.5B"
    )
    Wrapper = (
        LlamaModelWrapper
        if "llama" in model_path.lower()
        else QwenModelWrapper if "qwen" in model_path.lower() else None
    )
    assert Wrapper is not None, f"Unsupported model: {model_path}"
    wrapper = Wrapper(model_path, q4bit=False)

    generator = BatchGenerator(
        wrapper,
        stop_tokens=[ControlTokenTypes.EOS],
        topk=5,
        force_greedy=True,
    )

    prompts = [
        "Once upon a time",
        "In a galaxy far, far away",
    ]

    gen = generator.generate_yield(
        prompts, max_tokens=20, record_attention=True
    )

    outputs = defaultdict(list)
    for step in gen:
        for i, (res, stopped) in enumerate(step):
            print(
                f"[Sample {i}] Generated token: {res.token} (ID: {res.token_id}, Confidence: {res.confidence:.4f}) | Stopped: {stopped}"
            )
            if "" not in res.tags:
                outputs[i].append(res)

        print("-" * 40)

    for i in range(len(prompts)):
        generation_str = "".join([res.token for res in outputs[i]])
        print(f"Sample {i}: {generation_str}")
