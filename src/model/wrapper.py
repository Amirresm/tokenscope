from enum import Enum
from typing import Optional, Tuple
from tokenizers import AddedToken
import torch
import gc

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    LlamaForCausalLM,
    LlamaTokenizerFast,
)

type ModelType = LlamaForCausalLM
type TokenizerType = LlamaTokenizerFast


class ControlTokenTypes(Enum):
    BOS = "bos_token"
    EOS = "eos_token"
    # BOH = "boh_token"
    # EOH = "eoh_token"
    # EOM = "eom_token"
    # PYTHON = "python_token"
    #
    # FIM_PREFIX = "fim_prefix_token"
    # FIM_SUFFIX = "fim_suffix_token"
    # FIM_MIDDLE = "fim_middle_token"

    PAD = "pad_token"


class ModelWrapper:
    def __init__(
        self,
        model_name: str,
        device: str | None = None,
        model: Optional[ModelType] = None,
        tokenizer: Optional[TokenizerType] = None,
        q4bit: bool = False,
    ):
        self.device = device
        if self.device == "cpu":
            print("Using CPU device")
            print(f"Set number of CPU threads to {torch.get_num_threads()}")
        elif self.device == "cuda":
            if not torch.cuda.is_available():
                raise ValueError("CUDA is not available.")
            print(
                f"Using CUDA device: {torch.cuda.get_device_name(torch.cuda.current_device())}"
            )
        else:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"Auto-detected device: {self.device}")

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
                dtype="auto",
                device_map="auto",
                quantization_config=bnb_config,
                attn_implementation="eager",
            ).to(device)
            self.t: TokenizerType = AutoTokenizer.from_pretrained(
                self.model_name
            )

            # print model architecture
            print(self.m)

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
        id = int(id[0]) if isinstance(id, list) else int(id)
        return (token, id)

    def get_control_token_type(self, token: str) -> str | None:
        # ttype = next(
        #     (k for k, v in self.control_tokens.items() if v == token), None
        # )
        # if ttype is not None:
        #     return ttype

        # strip to avoid matching new lines or spaces
        clean_token = token.strip()

        for k, v in self.t.special_tokens_map.items():
            if v == clean_token:
                return k

        for v in self.t.added_tokens_decoder.values():
            if v.content == clean_token:
                return v.content

        for v in self.t.added_tokens_encoder.keys():
            if v == clean_token:
                return v

        return None

    def reset(self):
        gc.collect()
        if self.device == "cuda":
            torch.cuda.empty_cache()

    def unload(self):
        del self.m
        del self.t
        gc.collect()
        if self.device == "cuda":
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
        self.t.pad_token = self.t.eos_token
        self.control_tokens = {
            ControlTokenTypes.BOS: self.t.bos_token,
            ControlTokenTypes.EOS: self.t.eos_token,
            # ControlTokenTypes.BOH: "<|start_header_id|>",
            # ControlTokenTypes.EOH: "<|end_header_id|>",
            # ControlTokenTypes.EOM: "<|eom_id|>",
            # ControlTokenTypes.PYTHON: "<|python_tag|>",
        }


class QwenModelWrapper(ModelWrapper):
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
            # ControlTokenTypes.FIM_PREFIX: "<|fim_prefix|>",
            # ControlTokenTypes.FIM_SUFFIX: "<|fim_suffix|>",
            # ControlTokenTypes.FIM_MIDDLE: "<|fim_middle|>",
        }


class GenericModelWrapper(ModelWrapper):
    def __init__(
        self,
        model_name: str,
        device: str = "cuda",
        model: Optional[ModelType] = None,
        tokenizer: Optional[TokenizerType] = None,
        q4bit: bool = False,
    ):
        super().__init__(model_name, device, model, tokenizer, q4bit)
        if self.t.pad_token is None:
            self.t.pad_token = self.t.eos_token
        self.control_tokens = {
            ControlTokenTypes.BOS: self.t.bos_token,
            ControlTokenTypes.EOS: self.t.eos_token,
            ControlTokenTypes.PAD: self.t.pad_token,
        }
