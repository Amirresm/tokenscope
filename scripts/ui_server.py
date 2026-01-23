import os
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles


def create_app():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    ui_dir = os.path.join(current_dir, "..", "ui2", "dist")

    app = FastAPI()
    app.mount("/", StaticFiles(directory=ui_dir, html=True))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return app
