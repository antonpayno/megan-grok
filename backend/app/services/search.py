"""Búsqueda de usuarios, posts y tags (Persona 3)."""
from collections import Counter
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_
from sqlmodel import Session, select

from ..models import Follow, Like, Post, User
from ..schemas import PostOut, TagCount, UserPublic
from .posts import build_post_outs, clamp_limit
from .text import like_escape, normalize, tags_from_stored

SEARCH_CANDIDATE_LIMIT = 200
TAGS_RESULT_LIMIT = 10
TRENDING_DAYS = 14
TRENDING_DEFAULT_LIMIT = 15

SCORE_EXACT_TAG = 5
SCORE_TITLE_START = 4
SCORE_TITLE_CONTAINS = 3
SCORE_TAG_CONTAINS = 2
SCORE_DESCRIPTION = 1


def search_users(session: Session, q: str, limit: int) -> list[UserPublic]:
    """Match en username/display_name; prefijos primero y luego por seguidores."""
    if not q:
        return []

    pattern = f"%{like_escape(q)}%"
    users = list(
        session.exec(
            select(User).where(
                or_(
                    func.unaccent(func.lower(User.username)).like(pattern, escape="\\"),
                    func.unaccent(func.lower(User.display_name)).like(pattern, escape="\\"),
                )
            )
        ).all()
    )
    if not users:
        return []

    user_ids = [user.id for user in users]
    follower_rows = session.exec(
        select(Follow.followee_id, func.count())
        .where(Follow.followee_id.in_(user_ids))
        .group_by(Follow.followee_id)
    ).all()
    followers = {user_id: int(count) for user_id, count in follower_rows}

    def sort_key(user: User):
        username = normalize(user.username)
        display_name = normalize(user.display_name)
        starts_with = username.startswith(q) or display_name.startswith(q)
        return (0 if starts_with else 1, -followers.get(user.id, 0), username)

    users.sort(key=sort_key)
    return [UserPublic.model_validate(user) for user in users[:limit]]


def search_posts(
    session: Session,
    q: str,
    viewer: User | None,
    limit: int,
    craft: str | None = None,
    exact_tag: bool = False,
) -> list[PostOut]:
    """Candidatos por SQL (máx. 200) y puntuación final en Python."""
    if not q:
        return []

    pattern = f"%{like_escape(q)}%"
    if exact_tag:
        stmt = select(Post).where(
            Post.tags.like(f"%,{like_escape(q)},%", escape="\\")
        )
    else:
        stmt = select(Post).where(
            or_(
                func.unaccent(func.lower(Post.title)).like(pattern, escape="\\"),
                func.unaccent(func.lower(Post.description)).like(pattern, escape="\\"),
                Post.tags.like(pattern, escape="\\"),
            )
        )
    if craft is not None:
        stmt = stmt.where(Post.craft == craft)

    candidates = list(
        session.exec(
            stmt.order_by(Post.id.desc()).limit(SEARCH_CANDIDATE_LIMIT)
        ).all()
    )
    if not candidates:
        return []

    likes = _likes_by_post(session, [post.id for post in candidates])
    scored: list[tuple[int, Post]] = []
    for post in candidates:
        score = SCORE_EXACT_TAG if exact_tag else _score_post(post, q)
        if score > 0:
            scored.append((score, post))

    scored.sort(key=lambda item: (-item[0], -likes.get(item[1].id, 0), -item[1].id))
    top_posts = [post for _, post in scored[:limit]]
    return build_post_outs(session, top_posts, viewer)


def search_tags(session: Session, q: str, exact: bool = False) -> list[TagCount]:
    """Tags que contienen q (o iguales a q) con nº de posts que los usan."""
    if not q:
        return []
    if exact:
        stmt = select(Post.tags).where(
            Post.tags.like(f"%,{like_escape(q)},%", escape="\\")
        )
    else:
        stmt = select(Post.tags).where(Post.tags.like(f"%{like_escape(q)}%", escape="\\"))

    counts: Counter[str] = Counter()
    for stored in session.exec(stmt).all():
        for tag in set(tags_from_stored(stored)):
            matches = tag == q if exact else q in tag
            if matches:
                counts[tag] += 1
    return _top_tag_counts(counts, TAGS_RESULT_LIMIT)


def trending_tags(session: Session, limit: int) -> list[TagCount]:
    """Tags más usados en 14 días; si hay pocos distintos, completa con el histórico."""
    limit = clamp_limit(limit, default=TRENDING_DEFAULT_LIMIT)
    rows = list(session.exec(select(Post.tags, Post.created_at)).all())
    cutoff = datetime.now(timezone.utc) - timedelta(days=TRENDING_DAYS)

    recent_counts: Counter[str] = Counter()
    all_counts: Counter[str] = Counter()
    for stored, created_at in rows:
        tags = set(tags_from_stored(stored))
        for tag in tags:
            all_counts[tag] += 1
        if created_at is not None and _as_utc(created_at) >= cutoff:
            for tag in tags:
                recent_counts[tag] += 1

    ordered = _top_tag_counts(recent_counts, limit)
    if len(recent_counts) >= limit:
        return ordered

    # Completa con tags históricos que no estén ya entre los recientes.
    remaining = limit - len(ordered)
    historical = [
        (tag, count)
        for tag, count in sorted(all_counts.items(), key=lambda item: (-item[1], item[0]))
        if tag not in recent_counts
    ]
    for tag, count in historical[:remaining]:
        ordered.append(TagCount(tag=tag, count=count))
    return ordered


def _score_post(post: Post, q: str) -> int:
    tags = tags_from_stored(post.tags)
    if q in tags:
        return SCORE_EXACT_TAG

    title = normalize(post.title)
    if title.startswith(q):
        return SCORE_TITLE_START
    if q in title:
        return SCORE_TITLE_CONTAINS
    if any(q in tag for tag in tags):
        return SCORE_TAG_CONTAINS
    if q in normalize(post.description):
        return SCORE_DESCRIPTION
    return 0


def _likes_by_post(session: Session, post_ids: list[int | None]) -> dict[int, int]:
    if not post_ids:
        return {}
    rows = session.exec(
        select(Like.post_id, func.count())
        .where(Like.post_id.in_(post_ids))
        .group_by(Like.post_id)
    ).all()
    return {post_id: int(count) for post_id, count in rows}


def _top_tag_counts(counts: Counter[str], limit: int) -> list[TagCount]:
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [TagCount(tag=tag, count=count) for tag, count in ordered[:limit]]


def _as_utc(value: datetime) -> datetime:
    """SQLite puede devolver datetimes naive: los tratamos como UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
