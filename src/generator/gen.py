from typing import Callable, Literal
from dataclasses import dataclass
import typing

import numpy as np
import torch
import time

from src.model.wrapper import ControlTokenTypes, ModelWrapper

type TokenType = ControlTokenTypes | Literal["prompt"] | None
type StreamCallback = Callable[[str, TokenType], bool | None]


@dataclass
class StepResult:
    index: int
    token: str
    token_id: int
    confidence: float
    all_tokens: list[str]
    all_tokens_ids: list[int]
    all_confidences: list[float]
    tags: list[str]
    stop: bool = False
    prompt: bool = False
    manual: bool = False

    def to_json(self):
        return {
            "index": self.index,
            "token": self.token,
            "token_id": self.token_id,
            "confidence": self.confidence,
            "all_tokens_ids": self.all_tokens_ids,
            "all_tokens": self.all_tokens,
            "all_confidences": self.all_confidences,
            "tags": self.tags,
            "stop": self.stop,
            "prompt": self.prompt,
            "manual": self.manual,
        }

    @staticmethod
    def from_json(json_obj):
        base = StepResult(**json_obj)
        return base


def DefaultStreamCallback(token: str, token_type: TokenType) -> bool | None:
    """
    Default stream callback function for the generator.
    Returns True if the generation should be stopped.
    """
    if token_type == "prompt":
        sep = "\033[36;7m░\033[0m"
        print(token + sep, end="")
    else:
        print(token, end="", flush=True)
    return False


class Generator:
    MANUAL_TOKEN_DELAY = 0.001

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
        self.generation_results: list[StepResult] = []
        self.last_token_index = 0

    def reset(self):
        print("GENERATOR: Resetting ...")
        self.prompt = None
        self.max_tokens = self.default_max_tokens
        self.generation_results = []
        self.repeatition_limit = None
        self.last_token_index = 0
        self.model.reset()

    def generate_yield(
        self,
        prompt: str,
        max_tokens=None,
        stream: StreamCallback | bool | None = None,
        log_metric=False,
        repeatition_limit=None,
    ):
        self.prompt = prompt
        self.max_tokens = max_tokens or self.default_max_tokens

        self.generation_results = []
        self.repeatition_limit = repeatition_limit
        self.last_token_index = 0

        input_ids = self.model.str_to_input(self.prompt).input_ids
        for prompt_token_id in typing.cast(list[int], input_ids):
            prompt_token = self.model.ids_to_str(prompt_token_id)
            prompt_step_result = StepResult(
                index=self.last_token_index,
                token=prompt_token,
                token_id=prompt_token_id,
                confidence=1.0,
                all_tokens_ids=[prompt_token_id],
                all_tokens=[prompt_token],
                all_confidences=[1.0],
                prompt=True,
                tags=["prompt"],
            )
            self.generation_results.append(prompt_step_result)
            self.last_token_index += 1
            yield prompt_step_result

        if stream is True:
            stream = DefaultStreamCallback

        assert stream is None or callable(stream)
        if stream:
            stream(prompt + "\033[36;7m░\033[0m", "prompt")

        remaining_token_count = self.max_tokens
        new_generated_length = 0
        start_time = time.time()
        for _ in range(remaining_token_count):
            new_generated_length += 1
            stop = self._loop(
                stream=stream,
            )
            last_result = self.generation_results[-1]
            yield last_result
            if stop:
                print("Stopping generation (Stop token reached) ...")
                break

        if new_generated_length >= self.max_tokens:
            print("Stopping generation (Max tokens reached) ...")

        elapsed = time.time() - start_time

        if log_metric:
            self._log_metrics(elapsed, new_generated_length)

    def continue_yield(
        self,
        base: list[StepResult],
        index: int,
        forced_token: str | None,
        max_tokens=None,
        log_metric=False,
    ):
        self.max_tokens = max_tokens or self.default_max_tokens
        self.generation_results = base[:index]
        self.last_token_index = index

        print(
            f"GENERATOR: Changing path from index {index} ... (with {forced_token})"
        )

        for step_result in self.generation_results:
            time.sleep(self.MANUAL_TOKEN_DELAY)
            yield step_result

        if forced_token is not None:
            manual_token_ids = self.model.str_to_input(
                forced_token, add_special_tokens=False
            ).input_ids
            for manual_token_id in typing.cast(list[int], manual_token_ids):
                manual_token = self.model.ids_to_str(manual_token_id)
                manual_step_result = StepResult(
                    index=self.last_token_index,
                    token=manual_token,
                    token_id=manual_token_id,
                    confidence=1.0,
                    all_tokens_ids=[manual_token_id],
                    all_tokens=[manual_token],
                    all_confidences=[1.0],
                    manual=True,
                    tags=["manual"],
                )
                self.generation_results.append(manual_step_result)
                self.last_token_index += 1
                time.sleep(self.MANUAL_TOKEN_DELAY)
                yield manual_step_result

        remaining_token_count = self.max_tokens
        new_generated_length = 0
        start_time = time.time()
        for _ in range(remaining_token_count):
            new_generated_length += 1
            stop = self._loop()
            last_result = self.generation_results[-1]
            yield last_result
            if stop:
                print("Stopping generation (Stop token reached) ...")
                break
        elapsed = time.time() - start_time

        if new_generated_length >= self.max_tokens:
            print("Stopping generation (Max tokens reached) ...")

        if log_metric:
            self._log_metrics(elapsed, new_generated_length)

    def fim_yield(
        self,
        base: list[StepResult],
        start_index: int,
        end_index: int,
        replace_tokens: str | None,
        max_tokens=None,
        log_metric=False,
    ):
        print(
            f"GENERATOR: FIM from index {start_index} ... (with {replace_tokens})"
        )
        self.max_tokens = max_tokens or self.default_max_tokens
        self.generation_results = base

        # clean old prefix and suffix tags
        for step_result in self.generation_results:
            if "prefix" in step_result.tags:
                step_result.tags.remove("prefix")
            if "suffix" in step_result.tags:
                step_result.tags.remove("suffix")

        prefix_special_token, prefix_special_token_id = (
            self.model.get_control_token(ControlTokenTypes.FIM_PREFIX)
        )
        suffix_special_token, suffix_special_token_id = (
            self.model.get_control_token(ControlTokenTypes.FIM_SUFFIX)
        )
        middle_special_token, middle_special_token_id = (
            self.model.get_control_token(ControlTokenTypes.FIM_MIDDLE)
        )

        prefix_special_token = StepResult(
            index=self.last_token_index,
            token=prefix_special_token,
            token_id=prefix_special_token_id,
            confidence=1.0,
            all_tokens_ids=[prefix_special_token_id],
            all_tokens=[prefix_special_token],
            all_confidences=[1.0],
            prompt=True,
            tags=["special", "prefix"],
        )
        prefix_tokens = self.generation_results[: start_index + 1]
        for t in prefix_tokens:
            t.tags.append("prefix")

        suffix_special_token = StepResult(
            index=self.last_token_index + 1,
            token=suffix_special_token,
            token_id=suffix_special_token_id,
            confidence=1.0,
            all_tokens_ids=[suffix_special_token_id],
            all_tokens=[suffix_special_token],
            all_confidences=[1.0],
            prompt=True,
            tags=["special", "suffix"],
        )
        suffix_tokens = self.generation_results[end_index + 1 :]
        for t in suffix_tokens:
            t.tags.append("suffix")

        middle_special_token = StepResult(
            index=self.last_token_index + 2,
            token=middle_special_token,
            token_id=middle_special_token_id,
            confidence=1.0,
            all_tokens_ids=[middle_special_token_id],
            all_tokens=[middle_special_token],
            all_confidences=[1.0],
            prompt=True,
            tags=["special", "suffix"],
        )

        replace_step_tokens = []
        if replace_tokens is not None:
            manual_token_ids = self.model.str_to_input(
                replace_tokens, add_special_tokens=False
            ).input_ids
            for manual_token_id in typing.cast(list[int], manual_token_ids):
                manual_token = self.model.ids_to_str(manual_token_id)
                manual_step_result = StepResult(
                    index=self.last_token_index,
                    token=manual_token,
                    token_id=manual_token_id,
                    confidence=1.0,
                    all_tokens_ids=[manual_token_id],
                    all_tokens=[manual_token],
                    all_confidences=[1.0],
                    manual=True,
                    tags=["manual", "prefix"],
                )
                replace_step_tokens.append(manual_step_result)

        prefix = [prefix_special_token] + prefix_tokens + replace_step_tokens
        suffix = [suffix_special_token] + suffix_tokens + [middle_special_token]

        self.generation_results = prefix + suffix
        self.last_token_index = len(self.generation_results)

        for i, st in enumerate(self.generation_results):
            st.index = i

        for step_result in self.generation_results:
            time.sleep(self.MANUAL_TOKEN_DELAY)
            yield step_result

        remaining_token_count = self.max_tokens
        new_generated_length = 0
        start_time = time.time()
        for _ in range(remaining_token_count):
            new_generated_length += 1
            stop = self._loop()
            last_result = self.generation_results[-1]
            yield last_result
            if stop:
                print("Stopping generation (Stop token reached) ...")
                break
        elapsed = time.time() - start_time

        if new_generated_length >= self.max_tokens:
            print("Stopping generation (Max tokens reached) ...")

        if log_metric:
            self._log_metrics(elapsed, new_generated_length)

    def _loop(
        self,
        stream: StreamCallback | None = None,
    ):
        input_ids = (
            torch.Tensor([t.token_id for t in self.generation_results])
            .reshape(1, -1)
            .long()
            .to(self.device)
        )
        attention_mask = torch.ones_like(input_ids).to(self.device)
        logits = self.model.m(
            input_ids=input_ids, attention_mask=attention_mask
        ).logits
        token_id, confidence, all_token_ids, all_confidences = (
            self._process_logits(logits, topn=self.topk, coeff=1)
        )
        decoded_token = self.model.ids_to_str(token_id)
        token_control_type = self.model.get_control_token_type(decoded_token)

        tags = []
        if token_control_type is not None:
            tags.append("special")
            tags.append(token_control_type.name.lower())
        step_result = StepResult(
            index=self.last_token_index,
            token=decoded_token,
            token_id=token_id,
            confidence=confidence,
            all_tokens_ids=all_token_ids,
            all_tokens=[
                self.model.ids_to_str(tok_id) for tok_id in all_token_ids
            ],
            all_confidences=all_confidences,
            tags=tags,
        )
        self.generation_results.append(step_result)
        self.last_token_index += 1

        callback_stop = False
        if stream:
            callback_stop = stream(decoded_token, token_control_type)

        should_stop = self._check_stop_token(decoded_token)
        return should_stop or callback_stop == True

    def _process_logits(
        self, logits, topn=1, coeff=1
    ) -> tuple[int, float, list[int], list[float]]:
        logits = logits * coeff
        sf = torch.nn.functional.softmax(logits[:, -1, :], dim=-1)
        probs, indices = torch.topk(sf, topn)
        probs = probs.detach().cpu().to(torch.float16).numpy().reshape(-1)
        indices = indices.detach().cpu().numpy().reshape(-1)
        probs = probs / probs.sum()
        top_index = np.random.choice(topn, 1, p=probs)
        if self.force_greedy:
            top_index = 0
        token_id = indices[top_index]
        confidence = probs[top_index].item()

        return (
            int(token_id),
            confidence,
            typing.cast(list[int], indices.tolist()),
            probs.tolist(),
        )

    def generation_to_str(self, attach_prompt=True):
        generation = self.prompt if self.prompt and attach_prompt else ""
        for step_result in self.generation_results:
            generation += f"{step_result.token}"

        return generation

    def _log_metrics(self, elapsed, token_count):
        print(
            f"Generated {token_count} tokens in {elapsed:.3f} secs ({token_count/elapsed:.2f}tps)."
        )
        print("\n", "=" * 80)

    def _check_repetition(self, repeatition_limit, tok_conf_list):
        if repeatition_limit is not None:
            for seq_len in range(1, 5):
                last_n_tokens = [
                    int(t[0])
                    for t in tok_conf_list[-repeatition_limit * seq_len :]
                ]
                grouped_tokens = [
                    last_n_tokens[i : i + seq_len]
                    for i in range(0, len(last_n_tokens), seq_len)
                ]
                if (
                    grouped_tokens.count(grouped_tokens[-1])
                    >= repeatition_limit
                ):
                    print(
                        f"<GENERATOR: Repetition limit reached: {repeatition_limit}, stopping ...>"
                    )
                    return True

    def _check_fim_token(self, token):
        ttype = self.model.get_control_token_type(token)
        if (
            ttype == ControlTokenTypes.FIM_PREFIX
            or ttype == ControlTokenTypes.FIM_SUFFIX
            or ttype == ControlTokenTypes.FIM_MIDDLE
            or token == ControlTokenTypes.EOS
        ):
            return True
        return False

    def _check_stop_token(self, token):
        ttype = self.model.get_control_token_type(token)
        if (
            ttype in self.stop_tokens
            or token in self.stop_tokens
            or self.model.get_control_token_type(token) == ControlTokenTypes.EOS
        ):
            return True
        return False
