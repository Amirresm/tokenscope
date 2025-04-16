from contextlib import asynccontextmanager
import typing
import fastapi
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from src.generator.gen import StepResult
from src.server.model_state.model_state import ModelState

router = fastapi.APIRouter()


@router.post("/generate")
async def generate(request: fastapi.Request, request_data: dict):
    prompt = request_data["prompt"]
    max_tokens = request_data.get("max_tokens", 200)
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
    base = request_data.get("base", None)
    index = request_data.get("index", None)
    forced_token = request_data.get("forced_token", None)
    max_tokens = request_data.get("max_tokens", 200)

    base = [StepResult.from_json(step) for step in base]
    model_state = typing.cast(ModelState, request.state.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.continue_generate(
            base,
            index,
            forced_token,
            max_tokens=max_tokens,
            should_stop=request.is_disconnected,
        ),
        headers=headers,
        media_type="text/event-stream",
    )


@router.post("/fim")
async def fim(request: fastapi.Request, request_data: dict):
    base = request_data.get("base", None)
    start_index = request_data.get("start_index", None)
    end_index = request_data.get("end_index", None)
    replace_tokens = request_data.get("replace_tokens", None)
    max_tokens = request_data.get("max_tokens", 200)
    if start_index is None or end_index is None:
        raise fastapi.HTTPException(
            status_code=400, detail="start_index and end_index are required"
        )

    base = [StepResult.from_json(step) for step in base]
    model_state = typing.cast(ModelState, request.state.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.fim(
            base,
            start_index,
            end_index,
            replace_tokens,
            max_tokens=max_tokens,
            should_stop=request.is_disconnected,
        ),
        headers=headers,
        media_type="text/event-stream",
    )


def create_app():
    @asynccontextmanager
    async def lifespan(app: fastapi.FastAPI):
        model_path = (
            # "/home/amirreza/projects/ai/models/llm/llama-3.2-3B-Instruct"
            "/home/amirreza/projects/ai/models/llm/Qwen2.5-Coder-7B"
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
