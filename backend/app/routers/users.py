"""PROPIETARIO: Persona 1 (backend core). Solo Persona 1 edita este archivo."""
from fastapi import APIRouter, File, HTTPException, UploadFile

from ..deps import CurrentUser, OptionalUser, SessionDep
from ..schemas import FollowOut, UserProfile, UserPublic, UserUpdate

router = APIRouter()

# OJO: las rutas /me van ANTES que /{username} para que no las capture.


@router.patch("/me", response_model=UserProfile)
def update_me(data: UserUpdate, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 1")


@router.post("/me/avatar", response_model=UserProfile)
def upload_avatar(session: SessionDep, user: CurrentUser, file: UploadFile = File(...)):
    """Guarda en MEDIA_DIR/avatars/<user_id>.png (redimensionado a 256x256) y pone avatar_url=/media/avatars/..."""
    raise HTTPException(501, "TODO Persona 1")


@router.get("/{username}", response_model=UserProfile)
def get_profile(username: str, session: SessionDep, viewer: OptionalUser):
    raise HTTPException(501, "TODO Persona 1")


@router.post("/{username}/follow", response_model=FollowOut)
def follow(username: str, session: SessionDep, user: CurrentUser):
    """Idempotente. 400 si intentas seguirte a ti mismo."""
    raise HTTPException(501, "TODO Persona 1")


@router.delete("/{username}/follow", response_model=FollowOut)
def unfollow(username: str, session: SessionDep, user: CurrentUser):
    raise HTTPException(501, "TODO Persona 1")


@router.get("/{username}/followers", response_model=list[UserPublic])
def followers(username: str, session: SessionDep):
    raise HTTPException(501, "TODO Persona 1")


@router.get("/{username}/following", response_model=list[UserPublic])
def following(username: str, session: SessionDep):
    raise HTTPException(501, "TODO Persona 1")
