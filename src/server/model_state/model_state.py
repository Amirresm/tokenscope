import json
import threading
from typing import Awaitable, Callable
import asyncio


from src.generator.gen_batch import BatchGenerator
from src.model.wrapper import (
    ControlTokenTypes,
    LlamaModelWrapper,
    QwenModelWrapper,
)
from src.generator.gen import Generator, StepResult


class ModelState:
    def __init__(self, model_path: str) -> None:
        Wrapper = (
            LlamaModelWrapper
            if "llama" in model_path.lower()
            else QwenModelWrapper if "qwen" in model_path.lower() else None
        )
        assert Wrapper is not None, f"Unsupported model: {model_path}"
        wrapper = Wrapper(model_path, q4bit=False)
        self.generate_lock = threading.Lock()

        self.generator = Generator(
            wrapper,
            stop_tokens=[ControlTokenTypes.EOS],
            topk=5,
            force_greedy=True,
        )

        self.batch_generator = BatchGenerator(
            wrapper,
            stop_tokens=[ControlTokenTypes.EOS],
            topk=5,
            force_greedy=True,
        )

    async def generate(
        self,
        prompt: str,
        max_tokens: int,
        use_gen_batch: bool = False,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Starting generation ...")
            if use_gen_batch:
                self.batch_generator.reset()
                for batch in self.batch_generator.generate_yield(
                    prompt, max_tokens=max_tokens, log_metric=True, record_attention=True
                ):
                    token, stop = batch[0]
                    if stop:
                        print("Reaching end...")
                        break
                    if should_stop and await should_stop():
                        print("Stopping generation ...")
                        break
                    json_rep = token.to_dict()
                    stringified_token = json.dumps(json_rep)
                    stringified_token.replace("\n", "\\n")
                    stringified_token += "\n"
                    yield stringified_token
                    await asyncio.sleep(0)
            else:
                self.generator.reset()
                for token in self.generator.generate_yield(
                    prompt, max_tokens=max_tokens, log_metric=True
                ):
                    if should_stop and await should_stop():
                        print("Stopping generation ...")
                        break
                    json_rep = token.to_json()
                    stringified_token = json.dumps(json_rep)
                    stringified_token.replace("\n", "\\n")
                    stringified_token += "\n"
                    yield stringified_token
                    await asyncio.sleep(0)

    async def continue_generate(
        self,
        base: list[StepResult],
        index: int,
        forced_token: str | None,
        max_tokens: int,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        print("Waiting for model lock ...")
        with self.generate_lock:
            print("Continuing generation ...")
            for token in self.generator.continue_yield(
                base,
                index,
                forced_token,
                max_tokens=max_tokens,
                log_metric=True,
            ):
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break
                json_rep = token.to_json()
                stringified_token = json.dumps(json_rep)
                stringified_token.replace("\n", "\\n")
                stringified_token += "\n"
                yield stringified_token
                await asyncio.sleep(0)

    async def fim(
        self,
        base: list[StepResult],
        start_index: int,
        end_index: int,
        replace_tokens: str | None,
        max_tokens: int,
        should_stop: Callable[[], Awaitable[bool]] | None = None,
    ):
        print("Waiting for model lock ...")
        with self.generate_lock:
            print("FIM ...")
            print(f"start_index: {start_index}, end_index: {end_index}")
            print(f"replace_tokens: {replace_tokens}")

            for token in self.generator.fim_yield(
                base,
                start_index,
                end_index,
                replace_tokens,
                max_tokens=max_tokens,
                log_metric=True,
            ):
                if should_stop and await should_stop():
                    print("Stopping generation ...")
                    break
                json_rep = token.to_json()
                stringified_token = json.dumps(json_rep)
                stringified_token.replace("\n", "\\n")
                stringified_token += "\n"
                yield stringified_token
                await asyncio.sleep(0)
