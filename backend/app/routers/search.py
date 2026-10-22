"""PROPIETARIO: Persona 3 (backend social). Solo Persona 3 edita este archivo."""
from typing import Literal

from fastapi import APIRouter

from ..deps import OptionalUser, SessionDep
from ..schemas import SearchResults, TagCount
from ..services.posts import clamp_limit
from ..services.search import (
    search_posts,
    search_tags,
    search_users,
    trending_tags as compute_trending_tags,
)
from ..services.text import normalize

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
    term = normalize(q)
    if not term:
        return SearchResults(users=[], posts=[], tags=[])

    exact_tag = term.startswith("#")
    if exact_tag:
        term = term.lstrip("#").strip()
        if not term:
            return SearchResults(users=[], posts=[], tags=[])

    limit = clamp_limit(limit)
    users = [] if exact_tag or type == "posts" else search_users(session, term, limit)
    posts = [] if type == "users" else search_posts(
        session, term, viewer, limit, craft=craft, exact_tag=exact_tag
    )
    tags = [] if type != "all" else search_tags(session, term, exact=exact_tag)
    return SearchResults(users=users, posts=posts, tags=tags)


@router.get("/tags/trending", response_model=list[TagCount])
def trending_tags(session: SessionDep, limit: int = 15):
    return compute_trending_tags(session, limit)
