import json
import typing

import requests
from websockets.sync.client import connect

from src.generator.generator import Generator, GeneratorItem
from src.generator.token_node import Token


class GenClient(Generator):
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port

    def generate_yield(
        self,
        prompts: str | list[str],
        prompts_tokens: list[list[Token]] | None = None,
        max_tokens=None,
        topk=1,
        topp=1,
        coeff=1.0,
        alternatives=5,
        record_attention: bool = False,
        attention_layer=-1,
        attention_top_n=10,
        log_metric=False,
    ) -> typing.Generator[list[GeneratorItem], None, None]:
        with connect(
            f"ws://{self.host}:{self.port}/gen/ws",
            open_timeout=600,
            ping_interval=None,
            ping_timeout=None,
        ) as websocket:
            init_message = {
                "prompt": prompts,
                "prompts_tokens": (
                    [
                        [token.to_dict() for token in token_list]
                        for token_list in prompts_tokens
                    ]
                    if prompts_tokens is not None
                    else None
                ),
                "max_tokens": max_tokens,
                "topk": topk,
                "topp": topp,
                "coeff": coeff,
                "alternatives": alternatives,
                "record_attention": record_attention,
                "attention_layer": attention_layer,
                "attention_top_n": attention_top_n,
                "log_metric": log_metric,
            }
            websocket.send(json.dumps(init_message))

            while True:
                message = websocket.recv()
                payload = json.loads(message)
                message_type = payload.get("type", "")
                message_data = payload.get("data", {})

                if message_type == "end":
                    break
                elif message_type == "step":
                    step = GeneratorItem(
                        token=Token.from_dict(message_data["token"]),
                        stop=message_data["stop"],
                        fresh=message_data["fresh"],
                    )
                    yield [step]
                elif message_type == "error":
                    raise Exception(
                        f"Server error: {message_data.get('message', '')}"
                    )
                else:
                    print(f"Unknown message type: {message_type}")
                    break

    def prompts_to_token(self, prompts: list[str]) -> list[list[Token]]:
        url = f"http://{self.host}:{self.port}/gen/prompts_to_tokens"
        payload = {"prompts": prompts}
        response = requests.post(url, json=payload)
        response_data = response.json()
        tokens_data = response_data["tokens"]

        tokens = [
            [Token.from_dict(token_dict) for token_dict in token_list]
            for token_list in tokens_data
        ]

        return tokens
