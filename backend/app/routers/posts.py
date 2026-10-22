"""PROPIETARIO: Persona 3 (backend social). Solo Persona 3 edita este archivo."""
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import delete, func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from ..deps import CurrentUser, OptionalUser, SessionDep
from ..models import Comment, Follow, Like, Post, Save, User
from ..schemas import CommentIn, CommentOut, FeedPage, LikeOut, PostCreate, PostOut, SaveOut
from ..services.posts import (
    build_comment_outs,
    build_post_outs,
    get_post_or_404,
    page_posts,
)
from ..services.text import like_escape, normalize, normalize_tags, tags_stored

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
    stmt = select(Post)
    if mode == "following":
        if viewer is None:
            raise HTTPException(401, "No autenticado")
        author_ids = set(
            session.exec(
                select(Follow.followee_id).where(Follow.follower_id == viewer.id)
            ).all()
        )
        author_ids.add(viewer.id)
        stmt = stmt.where(Post.author_id.in_(list(author_ids)))
    return page_posts(session, stmt, viewer, cursor, limit)


@router.get("/saved", response_model=FeedPage)
def saved(session: SessionDep, user: CurrentUser, cursor: int | None = None, limit: int = 20):
    stmt = select(Post).where(
        Post.id.in_(select(Save.post_id).where(Save.user_id == user.id))
    )
    return page_posts(session, stmt, user, cursor, limit)


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
    stmt = select(Post)

    if author is not None:
        found = session.exec(
            select(User).where(User.username == author.strip().lower())
        ).first()
        if found is None:
            raise HTTPException(404, "Usuario no encontrado")
        stmt = stmt.where(Post.author_id == found.id)

    if tag is not None:
        normalized_tag = normalize(tag).lstrip("#").strip()
        if not normalized_tag:
            return FeedPage(items=[], next_cursor=None)
        pattern = f"%,{like_escape(normalized_tag)},%"
        stmt = stmt.where(Post.tags.like(pattern, escape="\\"))

    if craft is not None:
        stmt = stmt.where(Post.craft == craft)

    return page_posts(session, stmt, viewer, cursor, limit)


@router.post("", response_model=PostOut, status_code=201)
def create_post(data: PostCreate, session: SessionDep, user: CurrentUser):
    if data.remix_of is not None:
        get_post_or_404(session, data.remix_of)

    pattern = data.pattern
    tags = normalize_tags(data.tags)
    post = Post(
        author_id=user.id,
        title=data.title,
        description=data.description,
        craft=pattern.craft,
        tags=tags_stored(tags),
        pattern=pattern.model_dump(),
        width=pattern.width,
        height=pattern.height,
        colors_count=len({cell for cell in pattern.cells if cell != -1}),
        remix_of=data.remix_of,
    )
    session.add(post)
    session.commit()
    session.refresh(post)
    return build_post_outs(session, [post], user)[0]


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: int, session: SessionDep, viewer: OptionalUser):
    post = get_post_or_404(session, post_id)
    return build_post_outs(session, [post], viewer)[0]


@router.delete("/{post_id}", status_code=204)
def delete_post(post_id: int, session: SessionDep, user: CurrentUser) -> Response:
    """Solo el autor (403 si no)."""
    post = get_post_or_404(session, post_id)
    if post.author_id != user.id:
        raise HTTPException(403, "No puedes borrar un patrón de otra persona")

    session.exec(delete(Like).where(Like.post_id == post_id))
    session.exec(delete(Save).where(Save.post_id == post_id))
    session.exec(delete(Comment).where(Comment.post_id == post_id))
    # Los remixes dejan de apuntar a un post que ya no existe.
    session.exec(update(Post).where(Post.remix_of == post_id).values(remix_of=None))
    session.delete(post)
    session.commit()
    return Response(status_code=204)


@router.post("/{post_id}/like", response_model=LikeOut)
def like(post_id: int, session: SessionDep, user: CurrentUser):
    get_post_or_404(session, post_id)
    if session.get(Like, (user.id, post_id)) is None:
        session.add(Like(user_id=user.id, post_id=post_id))
        try:
            session.commit()
        except IntegrityError:
            # Otra petición lo insertó a la vez: el resultado sigue siendo "liked".
            session.rollback()
    return LikeOut(liked=True, likes_count=_likes_count(session, post_id))


@router.delete("/{post_id}/like", response_model=LikeOut)
def unlike(post_id: int, session: SessionDep, user: CurrentUser):
    get_post_or_404(session, post_id)
    existing = session.get(Like, (user.id, post_id))
    if existing is not None:
        session.delete(existing)
        session.commit()
    return LikeOut(liked=False, likes_count=_likes_count(session, post_id))


@router.post("/{post_id}/save", response_model=SaveOut)
def save(post_id: int, session: SessionDep, user: CurrentUser):
    get_post_or_404(session, post_id)
    if session.get(Save, (user.id, post_id)) is None:
        session.add(Save(user_id=user.id, post_id=post_id))
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
    return SaveOut(saved=True)


@router.delete("/{post_id}/save", response_model=SaveOut)
def unsave(post_id: int, session: SessionDep, user: CurrentUser):
    get_post_or_404(session, post_id)
    existing = session.get(Save, (user.id, post_id))
    if existing is not None:
        session.delete(existing)
        session.commit()
    return SaveOut(saved=False)


@router.get("/{post_id}/comments", response_model=list[CommentOut])
def list_comments(post_id: int, session: SessionDep):
    get_post_or_404(session, post_id)
    comments = list(
        session.exec(
            select(Comment)
            .where(Comment.post_id == post_id)
            .order_by(Comment.created_at, Comment.id)
            .limit(200)
        ).all()
    )
    return build_comment_outs(session, comments)


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(post_id: int, data: CommentIn, session: SessionDep, user: CurrentUser):
    get_post_or_404(session, post_id)
    text = data.text.strip()
    if not text or len(text) > 500:
        raise HTTPException(422, "El comentario debe tener entre 1 y 500 caracteres")
    comment = Comment(post_id=post_id, user_id=user.id, text=text)
    session.add(comment)
    session.commit()
    session.refresh(comment)
    return build_comment_outs(session, [comment])[0]


def _likes_count(session: Session, post_id: int) -> int:
    return int(
        session.exec(
            select(func.count()).select_from(Like).where(Like.post_id == post_id)
        ).one()
    )
