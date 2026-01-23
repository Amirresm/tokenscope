import asyncio
import json

from fastapi.websockets import WebSocketDisconnect
from rich import print as rprint
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from websockets import ConnectionClosed

from src.generator.server.gen_provider import GeneratorProvider, ModelSource
from src.generator.token_node import Token

router = FastAPI().router


class SharedResources:
    provider: GeneratorProvider


shared_resources = SharedResources()


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/current_model")
async def current_model():
    provider = shared_resources.provider

    model_source = provider.model_source
    current_model = provider.model_name_or_path

    return {
        "model_source": model_source,
        "current_model": current_model,
    }


@router.get("/available_models")
async def available_models(source: str):
    provider = shared_resources.provider

    model_source = ModelSource(source)

    models = provider.get_available_models(model_source)

    return {"models": models}


@router.post("/load_model")
async def load_model(payload: dict):
    provider = shared_resources.provider

    source = ModelSource(payload["source"])
    model_name_or_path = payload["model_name_or_path"]

    provider.load_model(source, model_name_or_path)

    return {"status": "model loaded"}


@router.post("/prompts_to_tokens")
async def prompts_to_tokens(payload: dict):
    provider = shared_resources.provider

    prompts = payload["prompts"]
    tokens = provider.prompts_to_token(prompts)

    tokens = [
        [token.to_dict() for token in token_list] for token_list in tokens
    ]

    return {"tokens": tokens}


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    rprint(websocket.state)
    provider = shared_resources.provider

    print(f"Client connected: {websocket.client}")

    while True:
        try:
            data = await websocket.receive_text()
            payload = json.loads(data)
            prompt = payload.get("prompt", "")
            prompts_tokens_data = payload.get("prompts_tokens", None)
            prompts_tokens = (
                [
                    [Token.from_dict(token_dict) for token_dict in token_list]
                    for token_list in prompts_tokens_data
                ]
                if prompts_tokens_data is not None
                else None
            )
            max_tokens = payload.get("max_tokens", None)
            topk = payload.get("topk", 1)
            topp = payload.get("topp", 1)
            coeff = payload.get("coeff", 1.0)
            alternatives = payload.get("alternatives", 5)
            record_attention = payload.get("record_attention", None)
            attaention_layer = payload.get("attention_layer", -1)
            attention_top_n = payload.get("attention_top_n", 10)
            log_metric = payload.get("log_metric", False)

            for batch in provider.generate_yield(
                prompts=prompt,
                prompts_tokens=prompts_tokens,
                max_tokens=max_tokens,
                topk=topk,
                topp=topp,
                coeff=coeff,
                alternatives=alternatives,
                attention_layer=attaention_layer,
                attention_top_n=attention_top_n,
                record_attention=record_attention,
                log_metric=log_metric,
            ):
                step = batch[0]

                message = {
                    "type": "step",
                    "data": {
                        "token": step.token.to_dict(),
                        "stop": step.stop,
                        "fresh": step.fresh,
                    },
                }
                await websocket.send_text(json.dumps(message))
                await asyncio.sleep(0.01)

            message = {"type": "end"}

            await websocket.send_text(json.dumps(message))
        except (WebSocketDisconnect, ConnectionClosed):
            print(f"Client disconnected: {websocket.client}")
            break

        except Exception as e:
            rprint(f"Error: {e}")
            raise e


def create_app(prefix: str = "/gen"):
    provider = GeneratorProvider()
    shared_resources.provider = provider

    app = FastAPI(title="Generation Server")
    app.include_router(router, prefix=prefix)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
