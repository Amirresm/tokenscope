from contextlib import asynccontextmanager
import typing
import fastapi
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from src.server.model_state.model_state import ModelState

router = fastapi.APIRouter()


@router.get("/sub")
async def sub(request: fastapi.Request):
    model_state = typing.cast(ModelState, request.state.model_state)
    return StreamingResponse(model_state.next(), media_type="text/plain")


@router.post("/generate")
async def generate(request: fastapi.Request, request_data: dict):
    prompt = request_data["prompt"]
    max_tokens = request_data.get("max_tokens", 50)
    model_state = typing.cast(ModelState, request.state.model_state)

    return StreamingResponse(
        model_state.generate(prompt, max_tokens), media_type="text/plain"
    )


def create_app():
    @asynccontextmanager
    async def lifespan(app: fastapi.FastAPI):
        model_path = (
            # "/home/amirreza/projects/ai/models/llm/llama-3.2-3B-Instruct"
            "/home/amirreza/projects/ai/models/llm/Qwen2.5-Coder-1.5B"
        )
        model_state = ModelState(model_path)
        yield {"model_state": model_state}

    app = fastapi.FastAPI(lifespan=lifespan)
    app.include_router(router, prefix="/api")
    app.mount("/", StaticFiles(directory="ui", html=True), name="static")

    return app
