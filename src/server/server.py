import typing
import fastapi
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import requests

from src.generator.server.gen_provider import ModelSource
from src.providers.static_provider import StaticProvider
from src.server.model_state.model_state2 import ModelState

router = fastapi.APIRouter()


class SharedResources:
    model_state: ModelState
    static_provider: StaticProvider
    gen_server_host: str
    gen_server_port: int


shared_resources = SharedResources()


@router.get("/current_model")
async def current_model():
    gen_server_host = shared_resources.gen_server_host
    gen_server_port = shared_resources.gen_server_port
    gen_client_url = f"http://{gen_server_host}:{gen_server_port}/gen"

    response = requests.get(f"{gen_client_url}/current_model")
    response_data = response.json()

    model_source = response_data.get("model_source")
    current_model = response_data.get("current_model")

    return {
        "model_source": model_source,
        "current_model": current_model,
    }


@router.get("/available_models")
async def available_models(source: str):
    gen_server_host = shared_resources.gen_server_host
    gen_server_port = shared_resources.gen_server_port
    gen_client_url = f"http://{gen_server_host}:{gen_server_port}/gen"
    model_source = ModelSource(source)
    response = requests.get(
        f"{gen_client_url}/available_models",
        params={"source": model_source.value},
    )
    response_data = response.json()

    models = response_data.get("models", [])
    return {"models": models}


@router.post("/load_model")
async def load_model(payload: dict):
    source = ModelSource(payload["source"])
    model_name_or_path = payload["model_name_or_path"]
    gen_server_host = shared_resources.gen_server_host
    gen_server_port = shared_resources.gen_server_port
    gen_client_url = f"http://{gen_server_host}:{gen_server_port}/gen"

    response = requests.post(
        f"{gen_client_url}/load_model",
        json={
            "source": source.value,
            "model_name_or_path": model_name_or_path,
        },
    )
    response_data = response.json()
    if response.status_code == 200:
        model_state = typing.cast(ModelState, shared_resources.model_state)
        model_state.ast_service.update_tokenizer(model_name_or_path)

    return response_data


@router.get("/sessions")
async def get_sessions():
    model_state = typing.cast(ModelState, shared_resources.model_state)
    sessions = model_state.get_sessions()
    return {"sessions": list(sessions.keys())}


@router.get("/session_branches")
async def get_session_branches(session_id: str):
    model_state = typing.cast(ModelState, shared_resources.model_state)
    branches = model_state.get_session_branches(session_id)
    return {"branches": list(branches)}


@router.post("/prefill_generation")
async def prefill_generation(request_data: dict):
    session_id = request_data["session_id"]
    branch_id = request_data["branch_id"]

    model_state = typing.cast(ModelState, shared_resources.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.prefill_generation(
            session_id=session_id,
            branch_id=branch_id,
        ),
        headers=headers,
        media_type="application/json",
    )


@router.post("/get_generation_tree")
async def get_generation_tree(request_data: dict):
    session_id = request_data["session_id"]

    model_state = typing.cast(ModelState, shared_resources.model_state)

    if session_id not in model_state.sessions:
        raise fastapi.HTTPException(status_code=404, detail="Session not found")

    nodes, edges = model_state.sessions[session_id].generation_tree.to_tree()

    return {"nodes": nodes, "edges": edges}


@router.get("/get_ast")
async def get_ast(
    session_id: str,
    branch_id: str,
    start: int,
    end: int,
):
    model_state = typing.cast(ModelState, shared_resources.model_state)

    ast = model_state.get_ast(
        session_id,
        branch_id,
        start,
        end,
    )

    return ast


@router.post("/generate_new")
async def generate(request: fastapi.Request, request_data: dict):
    prompt = request_data["prompt"]
    max_tokens = request_data.get("max_tokens", 200)
    topk = request_data.get("topk", 1)
    topp = request_data.get("topp", 0)
    coeff = request_data.get("coeff", 1.0)
    alternatives = request_data.get("alternatives", 5)
    attention_layer = request_data.get("attention_layer", -1)
    attention_top_n = request_data.get("attention_top_n", 10)
    record_attention = attention_top_n > 0

    model_state = typing.cast(ModelState, shared_resources.model_state)
    # model_state.generator.set_attn_layer(attn_layer)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.generate_new(
            prompt=prompt,
            max_tokens=max_tokens,
            topk=topk,
            topp=topp,
            coeff=coeff,
            alternatives=alternatives,
            record_attention=record_attention,
            attention_layer=attention_layer,
            attention_top_n=attention_top_n,
            should_stop=request.is_disconnected,
        ),
        headers=headers,
        media_type="application/json",
    )


@router.post("/continue")
async def continue_generate(request: fastapi.Request, request_data: dict):
    session_id = request_data["session_id"]
    branch_id = request_data["branch_id"]
    branch_position = request_data["branch_position"]
    appended_prompt = request_data.get("appended_prompt", "")
    max_tokens = request_data.get("max_tokens", 200)
    resume_old_branch = request_data.get("resume_old_branch", False)
    topk = request_data.get("topk", 1)
    topp = request_data.get("topp", 1)
    coeff = request_data.get("coeff", 1.0)
    alternatives = request_data.get("alternatives", 5)
    attention_layer = request_data.get("attention_layer", -1)
    attention_top_n = request_data.get("attention_top_n", 10)
    record_attention = attention_top_n > 0

    model_state = typing.cast(ModelState, shared_resources.model_state)

    headers = {"X-Content-Type-Options": "nosniff"}

    return StreamingResponse(
        model_state.continue_generate(
            session_id=session_id,
            branch_id=branch_id,
            branch_position=branch_position,
            appended_prompt=appended_prompt,
            max_tokens=max_tokens,
            topk=topk,
            topp=topp,
            coeff=coeff,
            alternatives=alternatives,
            record_attention=record_attention,
            attention_layer=attention_layer,
            attention_top_n=attention_top_n,
            resume_old_branch=resume_old_branch,
            should_stop=request.is_disconnected,
        ),
        headers=headers,
        media_type="text/event-stream",
    )


# @router.post("/fim")
# async def fim(request: fastapi.Request, request_data: dict):
#     base = request_data.get("base", None)
#     start_index = request_data.get("start_index", None)
#     end_index = request_data.get("end_index", None)
#     replace_tokens = request_data.get("replace_tokens", None)
#     max_tokens = request_data.get("max_tokens", 200)
#     attn_layer = request_data.get("attn_layer", None)
#     if start_index is None or end_index is None:
#         raise fastapi.HTTPException(
#             status_code=400, detail="start_index and end_index are required"
#         )
#
#     base = [StepResult.from_json(step) for step in base]
#     model_state = typing.cast(ModelState, shared_resources.model_state)
#     model_state.generator.set_attn_layer(attn_layer)
#
#     headers = {"X-Content-Type-Options": "nosniff"}
#
#     return StreamingResponse(
#         model_state.fim(
#             base,
#             start_index,
#             end_index,
#             replace_tokens,
#             max_tokens=max_tokens,
#             should_stop=request.is_disconnected,
#         ),
#         headers=headers,
#         media_type="text/event-stream",
#     )


@router.get("/fetch_projects")
async def fetch_projects():
    static_provider = typing.cast(
        StaticProvider, shared_resources.static_provider
    )
    projects = static_provider.get_project_names()
    return projects


@router.get("/get_project")
async def get_project(project_name: str):
    static_provider = typing.cast(
        StaticProvider, shared_resources.static_provider
    )
    project = static_provider.get_project_info(project_name)
    return project


@router.get("/get_sample")
async def get_sample(project_name: str, task_id: str):
    static_provider = typing.cast(
        StaticProvider, shared_resources.static_provider
    )
    sample = static_provider.get_sample(project_name, task_id)
    return sample


def create_app(
    prefix: str = "/api",
    gen_server_host: str = "localhost",
    gen_server_port: int = 4001,
):
    model_state = ModelState(
        gen_server_host=gen_server_host,
        gen_server_port=gen_server_port,
    )

    static_provider = StaticProvider(
        root_dir="/home/amirreza/projects/ubc/tl_code/results"
    )

    shared_resources.model_state = model_state
    shared_resources.static_provider = static_provider
    shared_resources.gen_server_host = gen_server_host
    shared_resources.gen_server_port = gen_server_port

    app = fastapi.FastAPI(title="Orchestration Server")
    app.include_router(router, prefix=prefix)
    # app.mount("/", StaticFiles(directory="ui", html=True), name="static")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
