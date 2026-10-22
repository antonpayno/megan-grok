"""Punto de entrada. ARCHIVO COMPARTIDO: todos los routers ya están registrados,
no debería hacer falta tocarlo. Arranque:  uvicorn app.main:app --reload  (desde backend/)

Si existe frontend/dist, tamén serve a SPA compilada (demo nun só proceso).
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, CORS_ORIGINS, MEDIA_DIR
from .db import init_db
from .routers import auth, patterns, posts, search, users

FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"


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


# Demo dun só proceso: se o frontend está compilado, sérveo e deixa que React
# xestione as rutas (recarga en /p/28, /u/lucia, etc.).
if FRONTEND_DIST.is_dir():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    dist_root = FRONTEND_DIST.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        first_segment = full_path.split("/", 1)[0]
        if first_segment in {"api", "media"}:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")

        candidate = (dist_root / full_path).resolve()
        if (
            full_path
            and candidate.is_file()
            and candidate.is_relative_to(dist_root)
        ):
            return FileResponse(candidate)
        return FileResponse(dist_root / "index.html")
