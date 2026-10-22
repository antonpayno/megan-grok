"""Normalización de texto y tags, y búsqueda sin acentos en SQLite."""
import sqlite3
import unicodedata

from sqlalchemy import event
from sqlalchemy.engine import Engine

MAX_TAGS = 10
MAX_TAG_LEN = 30


def normalize(value: str) -> str:
    """Minúsculas, sin acentos y con los espacios colapsados."""
    decomposed = unicodedata.normalize("NFKD", value or "")
    without_marks = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return " ".join(without_marks.lower().split())


def normalize_tags(raw_tags: list[str]) -> list[str]:
    """Quita '#', normaliza, deduplica y limita a 10 tags de 1-30 caracteres."""
    result: list[str] = []
    seen: set[str] = set()
    for raw in raw_tags:
        for piece in str(raw).split(","):
            tag = normalize(piece).lstrip("#").strip()
            if not (1 <= len(tag) <= MAX_TAG_LEN) or tag in seen:
                continue
            seen.add(tag)
            result.append(tag)
            if len(result) >= MAX_TAGS:
                return result
    return result


def tags_stored(tags: list[str]) -> str:
    """Formato de BD: ',gato,kawaii,' (comas también en los extremos)."""
    return f",{','.join(tags)}," if tags else ""


def tags_from_stored(stored: str | None) -> list[str]:
    """',gato,kawaii,' -> ['gato', 'kawaii']."""
    return [tag for tag in (stored or "").split(",") if tag]


def like_escape(value: str) -> str:
    """Escapa comodines de SQL LIKE para buscar un tag literal."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _sqlite_unaccent(value):
    if value is None:
        return None
    decomposed = unicodedata.normalize("NFKD", str(value))
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


@event.listens_for(Engine, "connect")
def _register_sqlite_functions(dbapi_connection, _connection_record) -> None:
    """Registra unaccent() en CUALQUIER engine SQLite (también el de los tests)."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        dbapi_connection.create_function("unaccent", 1, _sqlite_unaccent, deterministic=True)
