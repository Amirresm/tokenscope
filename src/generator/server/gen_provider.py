from enum import Enum
from src.generator.generator import Generator
from src.generator.server.openai_generator import OpenAIGenerator
from src.generator.server.transformers_generator import BatchGenerator
from src.model.wrapper import (
    ControlTokenTypes,
    LlamaModelWrapper,
    QwenModelWrapper,
)


class ModelSource(str, Enum):
    TRANSFORMERS = "transformers"
    OPENAI = "openai"


class GeneratorProvider:
    def __init__(self):
        self.model_source: ModelSource | None = None
        self.model_name_or_path: str | None = None
        self.generator: Generator | None = None

    def load_model(self, source: ModelSource, model_name_or_path: str):
        if source == ModelSource.TRANSFORMERS:
            self.load_transformers(model_name_or_path)
        elif source == ModelSource.OPENAI:
            self.load_openai(model_name_or_path)
        else:
            raise ValueError(f"Unsupported source: {source}")

    def load_transformers(self, model_name_or_path: str):
        Wrapper = (
            LlamaModelWrapper
            if "llama" in model_name_or_path.lower()
            else (
                QwenModelWrapper
                if "qwen" in model_name_or_path.lower()
                else None
            )
        )
        assert Wrapper is not None, f"Unsupported model: {model_name_or_path}"
        wrapper = Wrapper(model_name_or_path, q4bit=False)

        self.generator = BatchGenerator(
            wrapper,
            stop_tokens=[ControlTokenTypes.EOS],
            topk=5,
            force_greedy=True,
        )
        self.model_source = ModelSource.TRANSFORMERS
        self.model_name_or_path = model_name_or_path

    def load_openai(self, model_name_or_path: str):
        available_models = OpenAIGenerator.get_available_models()
        model_info = [
            m for m in available_models if model_name_or_path == m["id"]
        ][0]

        self.generator = OpenAIGenerator(
            model_name=model_info["id"],
            model_hf_id=model_info["metadata"]["hugging_face_id"],
        )
        self.model_source = ModelSource.OPENAI
        self.model_name_or_path = model_name_or_path

    def get_available_models(self, source: ModelSource):
        if source == ModelSource.TRANSFORMERS:
            return BatchGenerator.get_available_models()
        elif source == ModelSource.OPENAI:
            return OpenAIGenerator.get_available_models()
        else:
            raise ValueError("Unsupported source.")

    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens=None,
        max_tokens=None,
        record_attention: bool = False,
        log_metric=False,
    ):
        if self.generator is None:
            raise ValueError("Generator model is not set.")

        yield from self.generator.generate_yield(
            prompts,
            prompts_tokens,
            max_tokens,
            record_attention,
            log_metric,
        )

    def prompts_to_token(self, prompts: list[str]):
        if self.generator is None:
            raise ValueError("Generator model is not set.")

        return self.generator.prompts_to_token(prompts)
