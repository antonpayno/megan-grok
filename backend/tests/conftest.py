"""Fixtures compartidas (ARCHIVO COMPARTIDO). BD SQLite en memoria por test.

    def test_algo(client, make_user):
        headers = make_user("ana")          # crea usuario directo en BD y devuelve cabeceras auth
        r = client.get("/api/auth/me", headers=headers)
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app import models  # noqa: F401
from app.db import get_session
from app.main import app
from app.security import create_token, hash_password


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture
def client(session):
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def make_user(session):
    def _make(username: str, password: str = "secret123") -> dict[str, str]:
        user = models.User(
            username=username,
            email=f"{username}@test.com",
            password_hash=hash_password(password),
            display_name=username.title(),
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        return {"Authorization": f"Bearer {create_token(user.id)}"}

    return _make
