from typing import Callable, Literal

import numpy as np
import torch
import time

from src.model.wrapper import ControlTokenTypes, ModelWrapper

type TokenType = ControlTokenTypes | Literal["prompt"] | None
type StreamCallback = Callable[[str, TokenType], bool | None]


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
        self.topk = topk
        self.force_greedy = force_greedy
        self.thr = thr
        self.stop_tokens = stop_tokens
        self.device = self.model.m.device

    def generate(
        self,
        prompt: str,
        max_tokens=None,
        stream: StreamCallback | bool | None = None,
        log_metric=False,
        repeatition_limit=None,
    ):
        self.prompt = prompt
        input = self.model.str_to_input(prompt, return_tensors="pt").to(
            self.device
        )
        self.input_ids = input.input_ids
        self.attention_mask = input.attention_mask

        self.tok_conf_list = []
        self.repeatition_limit = repeatition_limit

        start_time = time.time()

        if stream is True:
            stream = DefaultStreamCallback

        assert stream is None or callable(stream)
        if stream:
            stream(prompt + "\033[36;7m░\033[0m", "prompt")

        for _ in range(max_tokens or self.default_max_tokens):
            stop = self._loop(
                stream=stream,
            )
            if stop:
                # self.tok_conf_list.pop()
                break

        elapsed = time.time() - start_time
        token_count = len(self.tok_conf_list)
        if stream == True:
            print()

        if log_metric:
            self._log_metrics(elapsed, token_count)

    def generate_yield(
        self,
        prompt: str,
        max_tokens=None,
        stream: StreamCallback | bool | None = None,
        log_metric=False,
        repeatition_limit=None,
    ):
        self.prompt = prompt
        input = self.model.str_to_input(prompt, return_tensors="pt").to(
            self.device
        )
        self.input_ids = input.input_ids
        self.attention_mask = input.attention_mask

        self.tok_conf_list = []
        self.repeatition_limit = repeatition_limit

        start_time = time.time()

        if stream is True:
            stream = DefaultStreamCallback

        assert stream is None or callable(stream)
        if stream:
            stream(prompt + "\033[36;7m░\033[0m", "prompt")

        for _ in range(max_tokens or self.default_max_tokens):
            stop = self._loop(
                stream=stream,
            )
            last_token_id, last_conf, last_all_tok_ids, last_all_confs = self.tok_conf_list[-1]
            last_token = self.model.ids_to_str(last_token_id)
            last_all_tokens = [self.model.ids_to_str(tok_id) for tok_id in last_all_tok_ids]
            yield {
                "token": last_token,
                "confidence": last_conf,
                "all_tokens": last_all_tokens,
                "all_confidences": last_all_confs,
                "stop": stop,
            }
            if stop:
                # self.tok_conf_list.pop()
                print("<GENERATOR: Stopping ...>")
                break

        elapsed = time.time() - start_time
        token_count = len(self.tok_conf_list)

        if log_metric:
            self._log_metrics(elapsed, token_count)

    def _loop(
        self,
        stream: StreamCallback | None = None,
    ):
        logits = self.model.m(
            input_ids=self.input_ids, attention_mask=self.attention_mask
        ).logits
        token_id, confidence, all_token_ids, all_confidences = self._process_logits(
            logits, topn=self.topk, coeff=1
        )
        self.tok_conf_list.append((token_id, confidence, all_token_ids, all_confidences))

        decoded_token = self.model.ids_to_str(token_id)
        token_control_type = self.model.get_control_token_type(decoded_token)

        callback_stop = False
        if stream:
            callback_stop = stream(decoded_token, token_control_type)

        self._update_inpute_attention(token_id)

        should_stop = self._check_stop_token(decoded_token)
        return should_stop or callback_stop == True

    def _process_logits(self, logits, topn=1, coeff=1):
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

        return token_id, confidence, indices.tolist(), probs.tolist()

    def _update_inpute_attention(self, token_id):
        self.input_ids = torch.cat(
            (
                self.input_ids,
                torch.tensor(
                    token_id.reshape(1, 1), device=self.input_ids.device
                ),
            ),
            dim=-1,
        )
        self.attention_mask = torch.cat(
            (
                self.attention_mask,
                torch.ones((1, 1), device=self.input_ids.device),
            ),
            dim=-1,
        )

    def generation_to_str(self, attach_prompt=True):
        generation = self.prompt if attach_prompt else ""
        for token_id, _ in self.tok_conf_list:
            token = self.model.t.decode(
                token_id, clean_up_tokenization_spaces=False
            )
            generation += f"{token}"

        return generation

    def _log_metrics(self, elapsed, token_count):
        print("\n", "=" * 80)
        print(
            f"Generated {token_count} tokens in {elapsed:.3f} secs ({token_count/elapsed:.2f}tps)."
        )

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

    def _check_stop_token(self, token):
        ttype = self.model.get_control_token_type(token)
        if (
            ttype in self.stop_tokens
            or token in self.stop_tokens
            or self.model.get_control_token_type(token) == ControlTokenTypes.EOS
        ):
            return True
        return False
