"""PROPIETARIO: Persona 1 (backend core). Solo Persona 1 edita este archivo."""
import re

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import select

from ..deps import CurrentUser, SessionDep
from ..models import User
from ..schemas import LoginIn, RegisterIn, TokenOut, UserPublic
from ..security import create_token, hash_password, verify_password

router = APIRouter()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize(value: str) -> str:
    return value.strip().lower()


def _token_out(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_token(user.id),
        user=UserPublic.model_validate(user),
    )


@router.post("/register", response_model=TokenOut, status_code=201)
def register(data: RegisterIn, session: SessionDep):
    """Crea usuario (username en minúsculas, email único) y devuelve token. 409 si ya existe."""
    username = _normalize(data.username)
    email = _normalize(data.email)
    display_name = data.display_name.strip() or username

    if not _EMAIL_RE.match(email):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ese email no es válido")

    if session.exec(select(User).where(User.username == username)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese usuario ya existe")
    if session.exec(select(User).where(User.email == email)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese email ya está registrado")

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(data.password),
        display_name=display_name,
    )
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        # Carrera entre dous rexistros simultáneos co mesmo username/email.
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese usuario o email ya existe")
    session.refresh(user)
    return _token_out(user)


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, session: SessionDep):
    """Login por username o email. 401 si credenciales incorrectas."""
    identifier = _normalize(data.username_or_email)
    user = session.exec(
        select(User).where(or_(User.username == identifier, User.email == identifier))
    ).first()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos"
        )
    return _token_out(user)


@router.get("/me", response_model=UserPublic)
def me(user: CurrentUser):
    return UserPublic.model_validate(user)
