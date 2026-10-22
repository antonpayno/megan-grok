"""Punto de entrada. ARCHIVO COMPARTIDO: todos los routers ya están registrados,
no debería hacer falta tocarlo. Arranque:  uvicorn app.main:app --reload  (desde backend/)
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import CORS_ORIGINS, MEDIA_DIR
from .db import init_db
from .routers import auth, patterns, posts, search, users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    init_db()
    yield


app = FastAPI(title="Pixel Pattern API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])          # Persona 1
app.include_router(users.router, prefix="/api/users", tags=["users"])       # Persona 1
app.include_router(patterns.router, prefix="/api", tags=["patterns"])       # Persona 2
app.include_router(posts.router, prefix="/api/posts", tags=["posts"])       # Persona 3
app.include_router(search.router, prefix="/api/search", tags=["search"])    # Persona 3

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/api/health")
def health():
    return {"ok": True}
