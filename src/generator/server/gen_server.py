from contextlib import asynccontextmanager
import json

from fastapi.websockets import WebSocketDisconnect, WebSocketState
from rich import print as rprint
from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
from websockets import ConnectionClosed

from src.generator.server.gen_provider import GeneratorProvider, ModelSource
from src.generator.token_node import Token

router = FastAPI().router


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/available_models")
async def available_models(request: Request, source: str):
    provider: GeneratorProvider = request.app.state.provider

    model_source = ModelSource(source)

    models = provider.get_available_models(model_source)

    return {"models": models}


@router.post("/load_model")
async def load_model(request: Request, payload: dict):
    provider: GeneratorProvider = request.app.state.provider

    source = ModelSource(payload["source"])
    model_name_or_path = payload["model_name_or_path"]

    provider.load_model(source, model_name_or_path)

    return {"status": "model loaded"}


@router.post("/prompts_to_tokens")
async def prompts_to_tokens(request: Request, payload: dict):
    provider: GeneratorProvider = request.app.state.provider

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
    provider: GeneratorProvider = websocket.app.state.provider

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
            record_attention = payload.get("record_attention", None)
            log_metric = payload.get("log_metric", False)

            for batch in provider.generate_yield(
                prompts=prompt,
                prompts_tokens=prompts_tokens,
                max_tokens=max_tokens,
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

            message = {"type": "end"}

            await websocket.send_text(json.dumps(message))
        except (WebSocketDisconnect, ConnectionClosed):
            print(f"Client disconnected: {websocket.client}")
            break

        except Exception as e:
            rprint(f"Error: {e}")
            raise e


def create_app():
    @asynccontextmanager
    async def lifespan(_: FastAPI):
        provider = GeneratorProvider()
        app.state.provider = provider
        yield

    app = FastAPI(lifespan=lifespan)
    app.include_router(router, prefix="/gen")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
