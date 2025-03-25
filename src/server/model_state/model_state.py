import json
import threading
from typing import Awaitable, Callable
import asyncio


from src.model.wrapper import ControlTokenTypes, LlamaModelWrapper
from src.generator.gen import Generator


class ModelState:
    def __init__(self, model_path: str) -> None:
        wrapper = LlamaModelWrapper(model_path)
        self.generate_lock = threading.Lock()

        self.generator = Generator(
            wrapper,
            stop_tokens=[ControlTokenTypes.EOS],
            topk=5,
            force_greedy=True,
        )

    async def generate(
        self,
        prompt: str,
        max_tokens: int,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Starting generation ...")
            self.generator.reset()
            for token in self.generator.generate_yield(
                prompt, max_tokens=max_tokens, log_metric=True
            ):
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break
                json_rep = {
                    "index": token.index,
                    "token": token.token,
                    "confidence": token.confidence,
                    "all_tokens_ids": token.all_tokens_ids,
                    "all_tokens": token.all_tokens,
                    "all_confidences": token.all_confidences,
                    "stop": token.stop,
                    "prompt": token.prompt,
                    "manual": token.manual,
                }
                stringified_token = json.dumps(json_rep)
                stringified_token.replace("\n", "\\n")
                stringified_token += "\n"
                yield stringified_token
                await asyncio.sleep(0)

    async def continue_generate(
        self,
        index: int,
        forced_token: str | None,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Continuing generation ...")
            for token in self.generator.change_path_yield(index, forced_token):
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break
                json_rep = {
                    "index": token.index,
                    "token": token.token,
                    "confidence": token.confidence,
                    "all_tokens_ids": token.all_tokens_ids,
                    "all_tokens": token.all_tokens,
                    "all_confidences": token.all_confidences,
                    "stop": token.stop,
                    "prompt": token.prompt,
                    "manual": token.manual,
                }
                stringified_token = json.dumps(json_rep)
                stringified_token.replace("\n", "\\n")
                stringified_token += "\n"
                yield stringified_token
                await asyncio.sleep(0)
