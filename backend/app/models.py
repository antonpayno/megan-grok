"""Tablas de la base de datos. ARCHIVO COMPARTIDO: no cambiar sin avisar al equipo.

Si necesitas un campo nuevo, añádelo con valor por defecto (para no romper a nadie)
y avisa en el chat del equipo. Borra app.db después de cambiar el esquema.
"""
from datetime import datetime, timezone

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True)  # minúsculas, [a-z0-9_.], 3-30
    email: str = Field(index=True, unique=True)
    password_hash: str
    display_name: str = ""
    bio: str = ""
    avatar_url: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class Follow(SQLModel, table=True):
    follower_id: int = Field(foreign_key="user.id", primary_key=True)
    followee_id: int = Field(foreign_key="user.id", primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)


class Post(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    author_id: int = Field(foreign_key="user.id", index=True)
    title: str
    description: str = ""
    craft: str = Field(index=True)  # "hama" | "cross_stitch"
    # Tags normalizados (minúsculas, sin '#') separados por comas y con comas en
    # los extremos: ",gato,kawaii," -> permite buscar con LIKE '%,gato,%'
    tags: str = ""
    pattern: dict = Field(sa_column=Column(JSON, nullable=False))  # PatternData
    width: int
    height: int
    colors_count: int
    remix_of: int | None = Field(default=None, foreign_key="post.id")
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Like(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    post_id: int = Field(foreign_key="post.id", primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)


class Save(SQLModel, table=True):
    user_id: int = Field(foreign_key="user.id", primary_key=True)
    post_id: int = Field(foreign_key="post.id", primary_key=True)
    created_at: datetime = Field(default_factory=utcnow)


class Comment(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    post_id: int = Field(foreign_key="post.id", index=True)
    user_id: int = Field(foreign_key="user.id")
    text: str
    created_at: datetime = Field(default_factory=utcnow)
