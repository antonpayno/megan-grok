"""PROPIETARIO: Persona 1 (backend core). Solo Persona 1 edita este archivo."""
from fastapi import APIRouter, HTTPException

from ..deps import CurrentUser, SessionDep
from ..schemas import LoginIn, RegisterIn, TokenOut, UserPublic

router = APIRouter()


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, session: SessionDep):
    """Crea usuario (username en minúsculas, email único) y devuelve token. 409 si ya existe."""
    raise HTTPException(501, "TODO Persona 1")


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, session: SessionDep):
    """Login por username o email. 401 si credenciales incorrectas."""
    raise HTTPException(501, "TODO Persona 1")


@router.get("/me", response_model=UserPublic)
def me(user: CurrentUser):
    return UserPublic.model_validate(user)
