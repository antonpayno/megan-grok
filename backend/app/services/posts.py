"""Serialización y paginación de posts sin consultas N+1."""
from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from ..models import Comment, Like, Post, Save, User
from ..schemas import CommentOut, FeedPage, PatternData, PostOut, UserPublic
from .text import tags_from_stored

DEFAULT_LIMIT = 20
MAX_LIMIT = 50


def clamp_limit(limit: int, default: int = DEFAULT_LIMIT) -> int:
    """El contrato acota el tamaño de página a 1..50."""
    try:
        value = int(limit)
    except (TypeError, ValueError):
        return default
    return max(1, min(MAX_LIMIT, value))


def get_post_or_404(session: Session, post_id: int) -> Post:
    post = session.get(Post, post_id)
    if post is None:
        raise HTTPException(404, "Patrón no encontrado")
    return post


def page_posts(
    session: Session,
    stmt,
    viewer: User | None,
    cursor: int | None,
    limit: int,
) -> FeedPage:
    """Pagina por id descendente: cursor = id del último post recibido."""
    limit = clamp_limit(limit)
    if cursor is not None:
        stmt = stmt.where(Post.id < cursor)
    posts = list(session.exec(stmt.order_by(Post.id.desc()).limit(limit + 1)).all())
    has_more = len(posts) > limit
    posts = posts[:limit]
    next_cursor = posts[-1].id if has_more and posts else None
    return FeedPage(items=build_post_outs(session, posts, viewer), next_cursor=next_cursor)


def build_post_outs(
    session: Session, posts: list[Post], viewer: User | None
) -> list[PostOut]:
    """Convierte posts en PostOut con 4-5 consultas agrupadas en total."""
    if not posts:
        return []

    post_ids = [post.id for post in posts]
    author_ids = {post.author_id for post in posts}

    like_rows = session.exec(
        select(Like.post_id, func.count())
        .where(Like.post_id.in_(post_ids))
        .group_by(Like.post_id)
    ).all()
    likes_count = {post_id: int(count) for post_id, count in like_rows}

    comment_rows = session.exec(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
    ).all()
    comments_count = {post_id: int(count) for post_id, count in comment_rows}

    liked_ids: set[int] = set()
    saved_ids: set[int] = set()
    if viewer is not None:
        liked_ids = set(
            session.exec(
                select(Like.post_id).where(
                    Like.user_id == viewer.id, Like.post_id.in_(post_ids)
                )
            ).all()
        )
        saved_ids = set(
            session.exec(
                select(Save.post_id).where(
                    Save.user_id == viewer.id, Save.post_id.in_(post_ids)
                )
            ).all()
        )

    authors = {
        user.id: UserPublic.model_validate(user)
        for user in session.exec(select(User).where(User.id.in_(author_ids))).all()
    }

    return [
        PostOut(
            id=post.id,
            author=authors[post.author_id],
            title=post.title,
            description=post.description,
            craft=post.craft,
            tags=tags_from_stored(post.tags),
            pattern=PatternData.model_validate(post.pattern),
            width=post.width,
            height=post.height,
            colors_count=post.colors_count,
            likes_count=likes_count.get(post.id, 0),
            comments_count=comments_count.get(post.id, 0),
            liked_by_me=post.id in liked_ids,
            saved_by_me=post.id in saved_ids,
            remix_of=post.remix_of,
            created_at=post.created_at,
        )
        for post in posts
    ]


def build_comment_outs(session: Session, comments: list[Comment]) -> list[CommentOut]:
    """Convierte comentarios en CommentOut con una sola consulta de autores."""
    if not comments:
        return []
    author_ids = {comment.user_id for comment in comments}
    authors = {
        user.id: UserPublic.model_validate(user)
        for user in session.exec(select(User).where(User.id.in_(author_ids))).all()
    }
    return [
        CommentOut(
            id=comment.id,
            author=authors[comment.user_id],
            text=comment.text,
            created_at=comment.created_at,
        )
        for comment in comments
    ]
