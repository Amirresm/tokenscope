from contextlib import asynccontextmanager
import typing
import fastapi
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from src.server.model_state.model_state import ModelState

router = fastapi.APIRouter()


@router.post("/generate")
async def generate(request: fastapi.Request, request_data: dict):
    prompt = request_data["prompt"]
    max_tokens = request_data.get("max_tokens", 50)
    model_state = typing.cast(ModelState, request.state.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.generate(
            prompt, max_tokens, should_stop=request.is_disconnected
        ),
        headers=headers,
        media_type="application/json",
    )


@router.post("/continue")
async def continue_generate(request: fastapi.Request, request_data: dict):
    index = request_data["index"]
    forced_token = request_data.get("forced_token", None)
    model_state = typing.cast(ModelState, request.state.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.continue_generate(
            index, forced_token, should_stop=request.is_disconnected
        ),
        headers=headers,
        media_type="text/event-stream",
    )


def create_app():
    @asynccontextmanager
    async def lifespan(app: fastapi.FastAPI):
        model_path = (
            "/home/amirreza/projects/ai/models/llm/llama-3.2-3B-Instruct"
            # "/home/amirreza/projects/ai/models/llm/Qwen2.5-Coder-1.5B"
        )
        model_state = ModelState(model_path)
        yield {"model_state": model_state}

    app = fastapi.FastAPI(lifespan=lifespan)
    app.include_router(router, prefix="/api")
    app.mount("/", StaticFiles(directory="ui", html=True), name="static")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
