from time import sleep
import json


from src.model.wrapper import ControlTokenTypes, LlamaModelWrapper
from src.generator.gen import Generator


class ModelState:
    def __init__(self, model_path: str) -> None:
        wrapper = LlamaModelWrapper(model_path)
        self.generator = Generator(wrapper, stop_tokens=[ControlTokenTypes.EOS], topk=5, force_greedy=True)

        self.state = 1

    def next(self):
        print(f"Current state: {self.state}")
        while True:
            if self.state < 10:
                self.state += 1
                sleep(1)
                yield f"{self.state}"
            else:
                self.state = 1
                print("Resetting state")
                break

    def generate(self, prompt: str, max_tokens: int):
        for token in self.generator.generate_yield(prompt, max_tokens=max_tokens, log_metric=True):
            stringified_token = json.dumps(token)
            yield stringified_token
