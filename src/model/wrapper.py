from enum import Enum
from typing import Optional, Tuple
import torch
import gc

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BatchEncoding,
    BitsAndBytesConfig,
    LlamaForCausalLM,
    LlamaTokenizerFast,
)

type ModelType = LlamaForCausalLM
type TokenizerType = LlamaTokenizerFast


class ControlTokenTypes(Enum):
    BOS = "bos_token"
    EOS = "eos_token"
    BOH = "boh_token"
    EOH = "eoh_token"
    EOM = "eom_token"
    PYTHON = "python_token"


class ModelWrapper:
    def __init__(
        self,
        model_name: str,
        device: str = "cuda",
        model: Optional[ModelType] = None,
        tokenizer: Optional[TokenizerType] = None,
        q4bit: bool = False,
    ):
        if model is not None and tokenizer is not None:
            self.m = model
            self.t = tokenizer
        else:
            self.model_name = model_name
            bnb_config = None
            if q4bit:
                model_dtype = torch.bfloat16
                bnb_config = BitsAndBytesConfig(
                    load_in_4bit=True,
                    bnb_4bit_quant_type="nf4",
                    bnb_4bit_use_double_quant=True,
                    bnb_4bit_compute_dtype=model_dtype,
                )

            self.m: ModelType = AutoModelForCausalLM.from_pretrained(
                self.model_name,
                torch_dtype="auto",
                device_map="auto",
                quantization_config=bnb_config,
            ).to(device)
            self.t: TokenizerType = AutoTokenizer.from_pretrained(
                self.model_name
            )

        self.control_tokens = {}

    def str_to_input(self, text: str, **decode_kwargs):
        return self.t(text, **decode_kwargs)

    def ids_to_str(self, ids: int | list[int] | torch.Tensor) -> str:
        return self.t.decode(ids)

    def get_control_token(self, control: ControlTokenTypes) -> Tuple[str, int]:
        token = self.control_tokens.get(control)
        if token is None:
            raise ValueError(f"Control token '{control}' not found.")
        id = self.t.convert_tokens_to_ids(token)
        assert id is int, f"Id is not int: {id}"
        return (token, id)

    def get_control_token_type(self, token: str) -> ControlTokenTypes | None:
        ttype = next(
            (k for k, v in self.control_tokens.items() if v == token), None
        )
        return ttype

    def reset(self):
        gc.collect()
        torch.cuda.empty_cache()

    def unload(self):
        del self.m
        del self.t
        gc.collect()
        torch.cuda.empty_cache()


class LlamaModelWrapper(ModelWrapper):
    def __init__(
        self,
        model_name: str,
        device: str = "cuda",
        model: Optional[ModelType] = None,
        tokenizer: Optional[TokenizerType] = None,
        q4bit: bool = False,
    ):
        super().__init__(model_name, device, model, tokenizer, q4bit)
        self.control_tokens = {
            ControlTokenTypes.BOS: self.t.bos_token,
            ControlTokenTypes.EOS: self.t.eos_token,
            ControlTokenTypes.BOH: "<|start_header_id|>",
            ControlTokenTypes.EOH: "<|end_header_id|>",
            ControlTokenTypes.EOM: "<|eom_id|>",
            ControlTokenTypes.PYTHON: "<|python_tag|>",
        }
