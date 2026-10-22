"""PROPIETARIO: Persona 3 (backend social). Solo Persona 3 edita este archivo."""
from typing import Literal

from fastapi import APIRouter, HTTPException

from ..deps import OptionalUser, SessionDep
from ..schemas import SearchResults, TagCount

router = APIRouter()


@router.get("", response_model=SearchResults)
def search(
    q: str,
    session: SessionDep,
    viewer: OptionalUser,
    type: Literal["all", "users", "posts"] = "all",
    craft: Literal["hama", "cross_stitch"] | None = None,
    limit: int = 20,
):
    """Busca usuarios (username/display_name), posts (título/descr./tags) y tags que coinciden.
    'q' que empieza por '#' = búsqueda exacta de tag. Sin acentos ni mayúsculas importantes."""
    raise HTTPException(501, "TODO Persona 3")


@router.get("/tags/trending", response_model=list[TagCount])
def trending_tags(session: SessionDep, limit: int = 15):
    raise HTTPException(501, "TODO Persona 3")
