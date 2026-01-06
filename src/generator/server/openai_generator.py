import json
import os
import typing

import numpy as np
import requests
import torch
import time
from openai import AsyncOpenAI, OpenAI
from transformers import AutoTokenizer

from rich import print as rprint

from src.generator.generator import Generator
from src.generator.server.transformers_generator import GeneratorItem
from src.generator.token_node import Token
from src.model.wrapper import ControlTokenTypes


class OpenAIGenerator(Generator):
    @staticmethod
    def get_available_models():
        url = "https://openrouter.ai/api/v1/models"
        headers = {"Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}"}
        response = requests.get(url, headers=headers)
        data = response.json()
        models = data.get("data", [])

        available_models = []
        for model in models:
            if "logprobs" in model.get("supported_parameters", []):
                available_models.append(model)

        available_models = [
            {"id": m["id"], "metadata": m} for m in available_models
        ]
        return available_models

    def __init__(
        self,
        model_name,
        model_hf_id,
        default_max_tokens=50,
        topk=1,
        force_greedy=False,
        thr=0.75,
        stop_tokens=[],
    ):
        self.default_max_tokens = default_max_tokens
        self.max_tokens = default_max_tokens
        self.topk = topk
        self.force_greedy = force_greedy
        self.thr = thr
        self.stop_tokens = stop_tokens
        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []
        self.generation_results: list[Token] = []

        self.model_name = model_name

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.getenv("OPENAI_API_KEY"),
        )

        try:
            if model_hf_id:
                self.tokenizer = AutoTokenizer.from_pretrained(model_hf_id)
            else:
                raise ValueError("Model exists but has no HF tokenizer.")
        except Exception as e:
            print(f"Error loading tokenizer: {e}")
            self.tokenizer = AutoTokenizer.from_pretrained("gpt2")

    def reset(self):
        self.prompt = None
        self.max_tokens = self.default_max_tokens
        self.num_sample_history = []
        self.time_history = []
        self.memory_history = []
        self.generation_results = []

    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens: list[list[Token]] | None = None,
        max_tokens=None,
        record_attention: bool = False,
        log_metric=False,
    ) -> typing.Generator[list[GeneratorItem], None, None]:
        self.max_tokens = max_tokens or self.default_max_tokens

        if prompts_tokens is not None:
            batch_size = len(prompts_tokens)
            generation_results = prompts_tokens
            prompts_strings = [
                "".join(t.token_string for t in generation_results[i])
                for i in range(batch_size)
            ]
        else:
            if isinstance(prompts, str):
                prompts = [prompts]
            batch_size = len(prompts)
            generation_results, _, _ = self._prepare_prompts(prompts)
            prompts_strings = prompts

        for i in range(len(generation_results[0])):
            step_result = [
                GeneratorItem(p[i], False, False) for p in generation_results
            ]
            yield step_result

        remaining_token_count = self.max_tokens
        generation_step_count = 0

        start_time = time.time()

        print(prompts_strings[0])

        results = self.client.completions.create(
            model=self.model_name,
            prompt=prompts_strings[0],
            max_tokens=remaining_token_count,
            n=1,
            temperature=0.1,
            stream=True,
            logprobs=True,
            extra_body={
                "top_logprobs": 5,
                "provider": {
                    "require_parameters": True,
                },
            },
        )

        for chunk in results:
            # print(chunk)
            choice = chunk.choices[0]
            # rprint(choice)
            model = chunk.model
            provider = chunk.provider  # type: ignore
            # print(f"Model: {model} | Provider: {provider}")
            if choice.logprobs is None:
                rprint(chunk)
            else:
                for t in choice.logprobs.content:  # type: ignore
                    generation_step_count += 1
                    token_string = t["token"]
                    token_id = self.tokenizer.convert_tokens_to_ids(
                        token_string
                    )
                    logprobs = t["logprob"]
                    prob = np.exp(logprobs) if logprobs is not None else 0.0

                    token_types = []
                    if token_string in self.tokenizer.all_special_tokens:
                        token_types.append("special")
                        if token_string == self.tokenizer.eos_token:
                            token_types.append("stop")
                        if token_string == self.tokenizer.pad_token:
                            token_types.append("pad")
                        if token_string == self.tokenizer.bos_token:
                            token_types.append("bos")

                    token = Token(
                        position=len(generation_results[0]),
                        token_string=token_string,
                        token_id=token_id,
                        confidence=prob,
                        alternative_tokens=[],
                        token_types=token_types,
                    )
                    print(token_string, end="")
                    for alt in t.get("top_logprobs", []):
                        alt_token_string = alt["token"]
                        alt_token_id = self.tokenizer.convert_tokens_to_ids(
                            alt_token_string
                        )
                        alt_logprob = alt["logprob"]
                        alt_prob = (
                            np.exp(alt_logprob)
                            if alt_logprob is not None
                            else 0.0
                        )
                        alt_token = Token(
                            # position=len(generation_results[0]),
                            position=-1,
                            token_string=alt_token_string,
                            token_id=alt_token_id,
                            confidence=alt_prob,
                            alternative_tokens=[],
                            token_types=[],
                        )
                        token.alternative_tokens.append(alt_token)

                    for i in range(batch_size):
                        generation_results[i].append(token)

                    step_result = [
                        GeneratorItem(generation_results[i][-1], False, True)
                        for i in range(batch_size)
                    ]
                    yield step_result

        elapsed = time.time() - start_time
        self.time_history.append(elapsed)

        self.num_sample_history.append(batch_size)

        if generation_step_count == remaining_token_count:
            print(
                f"Reached max tokens limit ({self.max_tokens}), stopping generation."
            )

        if log_metric:
            token_count = len(generation_results) * generation_step_count
            self._log_metrics(elapsed, token_count)

    def prompts_to_token(self, prompts: list[str]):
        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

        tokenized = self.tokenizer(
            prompts,
            padding="longest",
            max_length=512,
            add_special_tokens=False,
            return_tensors="pt",
        )
        input_ids: torch.Tensor = tokenized.input_ids

        generation_results: list[list[Token]] = [
            [] for _ in range(len(prompts))
        ]

        for j in range(input_ids.shape[1]):
            tokens = self.tokenizer.batch_decode(input_ids[:, j])
            for i in range(input_ids.shape[0]):
                token_id = int(input_ids[i, j].item())
                token = tokens[i]

                tags = []

                # TODO
                # control_type = self.model.get_control_token_type(token)
                # if control_type is not None:
                #     tags.append("special")
                #     if control_type == ControlTokenTypes.EOS:
                #         tags.append(ControlTokenTypes.PAD.name.lower())
                #     else:
                #         tags.append(control_type.name.lower())

                prompt_step_result = Token(
                    position=j,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    alternative_tokens=[],
                    token_types=tags,
                )

                generation_results[i].append(prompt_step_result)

        return generation_results

    def _prepare_prompts(self, prompts: list[str]):
        tokenized = self.tokenizer(
            prompts,
            # padding="longest",
            # max_length=512,
            add_special_tokens=False,
            return_tensors="pt",
        )
        input_ids: torch.Tensor = tokenized.input_ids

        generation_results: list[list[Token]] = [
            [] for _ in range(input_ids.shape[0])
        ]

        for j in range(input_ids.shape[1]):
            tokens = self.tokenizer.batch_decode(input_ids[:, j])
            for i in range(input_ids.shape[0]):
                token_id = int(input_ids[i, j].item())
                token = tokens[i]

                # control_type = self.model.get_control_token_type(token)
                control_type = None
                tags = ["prompt"]
                if control_type is not None:
                    tags.append("special")
                    if control_type == ControlTokenTypes.EOS:
                        tags.append(ControlTokenTypes.PAD.name.lower())
                    else:
                        tags.append(control_type.name.lower())

                prompt_step_result = Token(
                    position=j,
                    token_string=token,
                    token_id=token_id,
                    confidence=1.0,
                    alternative_tokens=[],
                    token_types=tags,
                )

                generation_results[i].append(prompt_step_result)

        return generation_results, None, None

    def _log_metrics(self, elapsed, token_count):
        print(
            f"Generated {token_count} tokens in {elapsed:.3f} secs ({token_count/elapsed:.2f}tps)."
        )
        print("\n", "=" * 80)

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
    available_models = OpenAIGenerator.get_available_models()
    rprint(available_models)

    model_info = [m for m in available_models if "llama-3.1" in m["id"]][0]

    rprint(f"Using model:", model_info)

    generator = OpenAIGenerator(
        model_name=model_info["id"],
        model_hf_id=model_info["hugging_face_id"],
    )

    prompts = [
        "Once upon a time in a land far, far away,",
    ]
    gen = generator.generate_yield(prompts, max_tokens=20, log_metric=True)

    for step in gen:
        for item in step:
            print(item.token.token_string, end="")
