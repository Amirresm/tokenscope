from dataclasses import dataclass
from typing import Protocol
import typing

from src.generator.token_node import Token


@dataclass()
class GeneratorItem:
    token: Token
    stop: bool
    fresh: bool


class Generator(Protocol):
    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens: list[list[Token]] | None = None,
        max_tokens=None,
        record_attention: bool = False,
        log_metric=False,
    ) -> typing.Generator[list[GeneratorItem], None, None]: ...

    def prompts_to_token(self, prompts: list[str]) -> list[list[Token]]: ...
