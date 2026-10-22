"""PROPIETARIO: Persona 3 (backend social). Solo Persona 3 edita este archivo."""
from typing import Literal

from fastapi import APIRouter, HTTPException, Response

from ..deps import CurrentUser, OptionalUser, SessionDep
from ..schemas import CommentIn, CommentOut, FeedPage, LikeOut, PostCreate, PostOut, SaveOut

router = APIRouter()

# OJO: rutas fijas (/feed, /saved) ANTES que /{post_id}.


@router.get("/feed", response_model=FeedPage)
def feed(
    session: SessionDep,
    viewer: OptionalUser,
    mode: Literal["explore", "following"] = "explore",
    cursor: int | None = None,
    limit: int = 20,
):
    """explore: todos, más recientes primero. following: solo de a quien sigo (401 sin sesión)."""
    raise HTTPException(501, "TODO Persona 3")


@router.get("/saved", response_model=FeedPage)
def saved(session: SessionDep, user: CurrentUser, cursor: int | None = None, limit: int = 20):
    raise HTTPException(501, "TODO Persona 3")


@router.get("", response_model=FeedPage)
def list_posts(
    session: SessionDep,
    viewer: OptionalUser,
    author: str | None = None,   # username
    tag: str | None = None,
    craft: Literal["hama", "cross_stitch"] | None = None,
    cursor: int | None = None,
    limit: int = 20,
):
    raise HTTPException(501, "TODO Persona 3")


@router.post("", response_model=PostOut, status_code=201)
def create_post(data: PostCreate, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, session: SessionDep, viewer: OptionalUser):
    raise HTTPException(501, "TODO Persona 3")


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: int, session: SessionDep, user: CurrentUser) -> Response:
    """Solo el autor (403 si no)."""
    raise HTTPException(501, "TODO Persona 3")


@router.post("/{post_id}/like", response_model=LikeOut)
def like(post_id: int, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")


@router.delete("/{post_id}/like", response_model=LikeOut)
def unlike(post_id: int, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")


@router.post("/{post_id}/save", response_model=SaveOut)
def save(post_id: int, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")


@router.delete("/{post_id}/save", response_model=SaveOut)
def unsave(post_id: int, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: int, session: SessionDep):
    raise HTTPException(501, "TODO Persona 3")


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(post_id: int, data: CommentIn, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 3")
