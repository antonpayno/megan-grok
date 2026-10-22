"""PROPIETARIO: Persona 1 (backend core). Solo Persona 1 edita este archivo."""
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import func
from sqlmodel import select

from ..deps import CurrentUser, OptionalUser, SessionDep
from ..models import Follow, Post, User
from ..schemas import FollowOut, UserProfile, UserPublic, UserUpdate

router = APIRouter()

# OJO: las rutas /me van ANTES que /{username} para que no las capture.


def _normalize(username: str) -> str:
    return username.strip().lower()


def _get_user_or_404(session: SessionDep, username: str) -> User:
    user = session.exec(
        select(User).where(User.username == _normalize(username))
    ).first()
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return user


def _followers_count(session: SessionDep, user_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Follow).where(Follow.followee_id == user_id)
    ).one()


def _following_count(session: SessionDep, user_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Follow).where(Follow.follower_id == user_id)
    ).one()


def _posts_count(session: SessionDep, user_id: int) -> int:
    return session.exec(
        select(func.count()).select_from(Post).where(Post.author_id == user_id)
    ).one()


def _profile(session: SessionDep, user: User, viewer: User | None) -> UserProfile:
    is_me = viewer is not None and viewer.id == user.id
    is_following = (
        viewer is not None
        and not is_me
        and session.get(Follow, (viewer.id, user.id)) is not None
    )
    return UserProfile(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        bio=user.bio,
        created_at=user.created_at,
        followers_count=_followers_count(session, user.id),
        following_count=_following_count(session, user.id),
        posts_count=_posts_count(session, user.id),
        is_following=is_following,
        is_me=is_me,
    )


def _follow_out(session: SessionDep, target_id: int, following: bool) -> FollowOut:
    return FollowOut(
        following=following,
        followers_count=_followers_count(session, target_id),
    )


@router.patch("/me", response_model=UserProfile)
def update_me(data: UserUpdate, session: SessionDep, user: CurrentUser):
    updates = data.model_dump(exclude_none=True)

    if "display_name" in updates:
        display_name = updates["display_name"].strip()
        if not display_name:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "El nombre no puede estar vacío"
            )
        user.display_name = display_name

    if "bio" in updates:
        bio = updates["bio"].strip()
        if len(bio) > 300:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "La bio no puede superar 300 caracteres"
            )
        user.bio = bio

    if "avatar_url" in updates:
        user.avatar_url = updates["avatar_url"].strip() or None

    session.add(user)
    session.commit()
    session.refresh(user)
    return _profile(session, user, viewer=user)


@router.post("/me/avatar", response_model=UserProfile)
def upload_avatar(session: SessionDep, user: CurrentUser, file: UploadFile = File(...)):
    """Guarda en MEDIA_DIR/avatars/<user_id>.png (redimensionado a 256x256) y pone avatar_url=/media/avatars/..."""
    raise HTTPException(501, "TODO Persona 1")


@router.get("/{username}", response_model=UserProfile)
def get_profile(username: str, session: SessionDep, viewer: OptionalUser):
    target = _get_user_or_404(session, username)
    return _profile(session, target, viewer)


@router.post("/{username}/follow", response_model=FollowOut)
def follow(username: str, session: SessionDep, user: CurrentUser):
    """Idempotente. 400 si intentas seguirte a ti mismo."""
    target = _get_user_or_404(session, username)
    if target.id == user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No puedes seguirte a ti mismo"
        )

    if session.get(Follow, (user.id, target.id)) is None:
        session.add(Follow(follower_id=user.id, followee_id=target.id))
        session.commit()

    return _follow_out(session, target.id, following=True)


@router.delete("/{username}/follow", response_model=FollowOut)
def unfollow(username: str, session: SessionDep, user: CurrentUser):
    target = _get_user_or_404(session, username)
    if target.id == user.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "No puedes dejar de seguirte a ti mismo"
        )

    existing = session.get(Follow, (user.id, target.id))
    if existing is not None:
        session.delete(existing)
        session.commit()

    return _follow_out(session, target.id, following=False)


@router.get("/{username}/followers", response_model=list[UserPublic])
def followers(username: str, session: SessionDep):
    target = _get_user_or_404(session, username)
    users = session.exec(
        select(User)
        .join(Follow, Follow.follower_id == User.id)
        .where(Follow.followee_id == target.id)
        .order_by(Follow.created_at.desc())
        .limit(100)
    ).all()
    return [UserPublic.model_validate(u) for u in users]


@router.get("/{username}/following", response_model=list[UserPublic])
def following(username: str, session: SessionDep):
    target = _get_user_or_404(session, username)
    users = session.exec(
        select(User)
        .join(Follow, Follow.followee_id == User.id)
        .where(Follow.follower_id == target.id)
        .order_by(Follow.created_at.desc())
        .limit(100)
    ).all()
    return [UserPublic.model_validate(u) for u in users]
