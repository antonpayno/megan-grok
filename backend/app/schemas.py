"""CONTRATO DE LA API (lo que entra y sale de cada endpoint).

ARCHIVO COMPARTIDO: es el espejo de frontend/src/api/types.ts.
Si cambias algo aquí, cambia también types.ts en el MISMO commit y avisa al equipo.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .config import MAX_PALETTE_COLORS, MAX_PATTERN_SIDE

Craft = Literal["hama", "cross_stitch"]


# ---------- Patrón (formato central de toda la app) ----------

class PaletteColor(BaseModel):
    id: str  # código del fabricante, p.ej. "H01" (Hama) o "310" (DMC)
    name: str
    hex: str = Field(pattern=r"^#[0-9A-Fa-f]{6}$")
    symbol: str | None = None  # símbolo para la carta de punto de cruz


class PatternData(BaseModel):
    craft: Craft
    width: int = Field(ge=1, le=MAX_PATTERN_SIDE)
    height: int = Field(ge=1, le=MAX_PATTERN_SIDE)
    palette: list[PaletteColor] = Field(max_length=MAX_PALETTE_COLORS)
    # Fila a fila (row-major): cells[y * width + x] = índice en palette, -1 = vacío
    cells: list[int]

    @model_validator(mode="after")
    def _check_cells(self):
        if len(self.cells) != self.width * self.height:
            raise ValueError("len(cells) debe ser width * height")
        n = len(self.palette)
        if any(c < -1 or c >= n for c in self.cells):
            raise ValueError("cells contiene índices fuera de la paleta")
        return self


class Palette(BaseModel):
    id: str  # "hama_midi", "dmc"
    name: str
    craft: Craft
    colors: list[PaletteColor]


# ---------- Usuarios / auth ----------

class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    display_name: str
    avatar_url: str | None = None


class UserProfile(UserPublic):
    bio: str
    created_at: datetime
    followers_count: int
    following_count: int
    posts_count: int
    is_following: bool  # False si no hay sesión o si es tu propio perfil
    is_me: bool


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-zA-Z0-9_.]+$")
    email: str
    password: str = Field(min_length=6)
    display_name: str = ""


class LoginIn(BaseModel):
    username_or_email: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserUpdate(BaseModel):
    display_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


class FollowOut(BaseModel):
    following: bool
    followers_count: int


# ---------- Posts / feed ----------

class PostCreate(BaseModel):
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=1000)
    tags: list[str] = Field(default_factory=list, max_length=10)
    pattern: PatternData
    remix_of: int | None = None


class PostOut(BaseModel):
    id: int
    author: UserPublic
    title: str
    description: str
    craft: Craft
    tags: list[str]
    pattern: PatternData
    width: int
    height: int
    colors_count: int
    likes_count: int
    comments_count: int
    liked_by_me: bool
    saved_by_me: bool
    remix_of: int | None
    created_at: datetime


class FeedPage(BaseModel):
    items: list[PostOut]
    next_cursor: int | None  # pásalo como ?cursor= para la siguiente página; None = fin


class LikeOut(BaseModel):
    liked: bool
    likes_count: int


class SaveOut(BaseModel):
    saved: bool


class CommentIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


class CommentOut(BaseModel):
    id: int
    author: UserPublic
    text: str
    created_at: datetime


# ---------- Búsqueda ----------

class TagCount(BaseModel):
    tag: str
    count: int


class SearchResults(BaseModel):
    users: list[UserPublic]
    posts: list[PostOut]
    tags: list[TagCount]
