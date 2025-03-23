import json
import threading


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

    def generate(self, prompt: str, max_tokens: int):
        with self.generate_lock:
            self.generator.reset()
            for token in self.generator.generate_yield(
                prompt, max_tokens=max_tokens, log_metric=True
            ):
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

    def continue_generate(self, index: int, forced_token: str):
        with self.generate_lock:
            for token in self.generator.change_path_yield(index, forced_token):
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
