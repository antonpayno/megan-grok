"""Dependencias comunes. Uso en cualquier router:

    from ..deps import SessionDep, CurrentUser, OptionalUser

    @router.get("/algo")
    def algo(session: SessionDep, user: CurrentUser): ...
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from .db import get_session
from .models import User
from .security import decode_token

_bearer = HTTPBearer(auto_error=False)

SessionDep = Annotated[Session, Depends(get_session)]


def get_optional_user(
    session: SessionDep,
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User | None:
    if creds is None:
        return None
    user_id = decode_token(creds.credentials)
    return session.get(User, user_id) if user_id is not None else None


def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "No autenticado")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
