"""PROPIETARIO: Persona 1. Rellena la BD con usuarios y patrones de demo.

Uso (desde backend/):
    python -m app.seed            # solo si la BD está vacía
    python -m app.seed --reset    # borra app.db y vuelve a sembrar

Contraseña de todos los usuarios demo: demo1234
"""
from __future__ import annotations

import argparse
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlmodel import Session, select

from . import models
from .config import BASE_DIR, DATABASE_URL
from .db import engine, init_db
from .schemas import PatternData
from .security import hash_password

DEMO_PASSWORD = "demo1234"
SEED_RANDOM = 42
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

# ---------------------------------------------------------------------------
# Paletas reales (subconjunto). Cada rol de color existe en Hama y en DMC.
# ---------------------------------------------------------------------------

ROLE_INFO = {
    "white": ("Blanco", "#FFFFFF"),
    "black": ("Negro", "#1A1A1A"),
    "red": ("Rojo", "#D62828"),
    "orange": ("Naranja", "#F77F00"),
    "yellow": ("Amarillo", "#FCBF49"),
    "green": ("Verde", "#2A9D8F"),
    "lgreen": ("Verde claro", "#8AC926"),
    "blue": ("Azul", "#1982C4"),
    "lblue": ("Azul claro", "#6BB8E8"),
    "purple": ("Morado", "#6A4C93"),
    "pink": ("Rosa", "#FF5D8F"),
    "lpink": ("Rosa claro", "#FFB3C6"),
    "brown": ("Marrón", "#8D5524"),
    "gray": ("Gris", "#9E9E9E"),
    "peach": ("Melocotón", "#FFD6A5"),
}

HAMA_IDS = {
    "white": "H01", "black": "H02", "red": "H03", "orange": "H04",
    "yellow": "H05", "green": "H06", "lgreen": "H07", "blue": "H08",
    "lblue": "H09", "purple": "H10", "pink": "H11", "lpink": "H12",
    "brown": "H13", "gray": "H14", "peach": "H15",
}

DMC_IDS = {
    "white": "blanc", "black": "310", "red": "321", "orange": "741",
    "yellow": "743", "green": "702", "lgreen": "907", "blue": "798",
    "lblue": "3846", "purple": "550", "pink": "605", "lpink": "3608",
    "brown": "433", "gray": "415", "peach": "3776",
}

# ---------------------------------------------------------------------------
# Arte ASCII original: '.' = celda vacía, cada letra = un rol de color.
# ---------------------------------------------------------------------------

DESIGNS: dict[str, dict] = {
    "heart": {
        "rows": [
            "............",
            "...ii..ii...",
            "..iiiiiiii..",
            ".iiiiiiiiii.",
            ".iiiiiiiiii.",
            ".iiiiiiiiii.",
            "..iiiiiiii..",
            "...iiiiii...",
            "....iiii....",
            ".....ii.....",
            "............",
            "............",
        ],
        "chars": {"i": "pink"},
    },
    "star": {
        "rows": [
            ".....yy.....",
            "....yyyy....",
            "....yyyy....",
            "yyyyyyyyyyyy",
            ".yyyyyyyyyy.",
            "..yyyyyyyy..",
            "...yyyyyy...",
            "..yyyyyyyy..",
            "..yyy..yyy..",
            ".yyy....yyy.",
            "yyy......yyy",
            "............",
        ],
        "chars": {"y": "yellow"},
    },
    "mushroom": {
        "rows": [
            "..............",
            "....rrrrrr....",
            "..rrrrrrrrrr..",
            ".rrwwrrrrwwrr.",
            "rrrwwrrrrwwrrr",
            "rrrrrrrrrrrrrr",
            ".rrrrrrrrrrrr.",
            "...wwwwwwww...",
            "...wwwwwwww...",
            "...wwwwwwww...",
            "...wwwwwwww...",
            "...wwwwwwww...",
            "..............",
            "..............",
        ],
        "chars": {"r": "red", "w": "white"},
    },
    "cat": {
        "rows": [
            "................",
            "..k..........k..",
            "..kk........kk..",
            "..kkk......kkk..",
            "..kkkkkkkkkkkk..",
            "..kkkkkkkkkkkk..",
            "..kkiikkkkiikk..",
            "..kkiikkkkiikk..",
            "..kkkkkkkkkkkk..",
            "..kkkkknnkkkkk..",
            "..kkkkkkkkkkkk..",
            "..kkkwwkkwwkkk..",
            "..kkkkkkkkkkkk..",
            "...kkkkkkkkkk...",
            "....kkkkkkkk....",
            "................",
        ],
        "chars": {"k": "black", "i": "pink", "n": "brown", "w": "white"},
    },
    "ghost": {
        "rows": [
            "..............",
            "....wwwwww....",
            "...wwwwwwww...",
            "..wwwwwwwwww..",
            "..wwwwwwwwww..",
            "..wwkkwwkkww..",
            "..wwkkwwkkww..",
            "..wwwwwwwwww..",
            "..wwwwwwwwww..",
            "..wwwwwwwwww..",
            "..wwwwwwwwww..",
            "..wwwwwwwwww..",
            "..w.ww.ww.ww..",
            "..............",
        ],
        "chars": {"w": "white", "k": "black"},
    },
    "rainbow": {
        "rows": [
            "....................",
            "..rrrrrrrrrrrrrrrr..",
            "...oooooooooooooo...",
            "....yyyyyyyyyyyy....",
            ".....gggggggggg.....",
            "......bbbbbbbb......",
            ".......cccccc.......",
            "....wwwwwwwwwwww....",
            "...wwwwwwwwwwwwww...",
            "....wwwwwwwwwwww....",
            "....................",
            "....................",
        ],
        "chars": {
            "r": "red", "o": "orange", "y": "yellow",
            "g": "green", "b": "blue", "c": "lblue", "w": "white",
        },
    },
    "strawberry": {
        "rows": [
            "............",
            "....gg......",
            "...gggg.....",
            "..rrrrrr....",
            ".rrrrrrrrr..",
            ".rrwrrwrrr..",
            ".rrrrrrrrrr.",
            ".rrwrrwrrrr.",
            "..rrrrrrrr..",
            "..rrrrrrrr..",
            "...rrrrrr...",
            "....rrrr....",
            ".....rr.....",
            "............",
        ],
        "chars": {"g": "lgreen", "r": "red", "w": "white"},
    },
    "smiley": {
        "rows": [
            "............",
            "....yyyy....",
            "..yyyyyyyy..",
            ".yyyyyyyyyy.",
            ".yykyyyykyy.",
            ".yyyyyyyyyy.",
            ".yyyyyyyyyy.",
            ".yyykkkkyyy.",
            "..yyyyyyyy..",
            "...yyyyyy...",
            "............",
            "............",
        ],
        "chars": {"y": "yellow", "k": "black"},
    },
    "plant": {
        "rows": [
            "..............",
            "......gg......",
            "....gggggg....",
            "...gg.gg.gg...",
            "......gg......",
            "....gggggg....",
            "..gg..gg..gg..",
            "..gg..gg..gg..",
            "......gg......",
            "......gg......",
            "....nnnnnn....",
            "...nnnnnnnn...",
            "...nnnnnnnn...",
            "....nnnnnn....",
            "..............",
            "..............",
        ],
        "chars": {"g": "green", "n": "brown"},
    },
    "frog": {
        "rows": [
            "................",
            "...gg......gg...",
            "..gggg....gggg..",
            "..gkgg....ggkg..",
            ".gggggggggggggg.",
            "gggggggggggggggg",
            "gggkggggggggkggg",
            "ggggkkkkkkkkgggg",
            ".gggggggggggggg.",
            "..gggggggggggg..",
            "...ggg....ggg...",
            "................",
        ],
        "chars": {"g": "lgreen", "k": "black"},
    },
    "flower": {
        "rows": [
            "..............",
            "....iiiiii....",
            "...iiiiiiii...",
            "..iiiyyyyiii..",
            "..iiyyyyyyii..",
            "...iiyyyyii...",
            "....iiiiii....",
            "......gg......",
            "......gg......",
            "...gg.gg.gg...",
            "......gg......",
            "......gg......",
            "..............",
            "..............",
        ],
        "chars": {"i": "pink", "y": "yellow", "g": "green"},
    },
}

# ---------------------------------------------------------------------------
# Usuarios demo
# ---------------------------------------------------------------------------

USERS = [
    ("lucia", "Lucía Ferro", "Cuentas HAMA, gatos y todo lo que sea kawaii. Galicia."),
    ("mario", "Mario Souto", "Punto de cruz y patrones retro. Pido perdón pola miña letra."),
    ("noa", "Noa Pena", "Diseño animalitos en pixel. Encargos por DM."),
    ("hugo", "Hugo Varela", "Fantasmas, setas y cosas raras. 8 bits forever."),
    ("ivan", "Iván Ríos", "Plantas y flores en punto de cruz. Biólogo de día."),
    ("alma", "Alma Cid", "Fresas, arcoíris y colores imposibles."),
    ("xiana", "Xiana Bouzas", "HAMA midi. Arcoíris grandes para paredes."),
    ("breogan", "Breogán Areas", "Patrones geométricos y estrellas. Team líneas rectas."),
]

FOLLOWS = [
    ("lucia", "noa"), ("lucia", "mario"), ("lucia", "xiana"),
    ("noa", "lucia"), ("noa", "mario"), ("noa", "hugo"),
    ("mario", "lucia"), ("mario", "hugo"), ("mario", "alma"),
    ("hugo", "noa"), ("hugo", "lucia"), ("hugo", "breogan"),
    ("ivan", "mario"), ("ivan", "alma"), ("ivan", "noa"),
    ("alma", "lucia"), ("alma", "noa"), ("alma", "hugo"),
    ("xiana", "lucia"), ("xiana", "noa"), ("xiana", "hugo"),
    ("breogan", "alma"), ("breogan", "ivan"), ("breogan", "lucia"),
]

# (diseño, escala, craft, autor, título, tags)
POSTS = [
    ("heart", 1, "hama", "lucia", "Corazón pixelado", ["kawaii", "pixelart"]),
    ("cat", 1, "hama", "noa", "Michi de 16 bits", ["gato", "kawaii"]),
    ("mushroom", 1, "hama", "mario", "Seta del bosque", ["naturaleza", "retro"]),
    ("strawberry", 1, "cross_stitch", "alma", "Fresa de verano", ["comida", "kawaii"]),
    ("rainbow", 1, "hama", "xiana", "Arcoíris total", ["pixelart", "kawaii"]),
    ("ghost", 1, "cross_stitch", "hugo", "Fantasmiño tímido", ["retro", "pixelart"]),
    ("smiley", 1, "hama", "breogan", "Sonrisa de 8 bits", ["retro", "pixelart"]),
    ("flower", 1, "cross_stitch", "lucia", "Flor de jardín", ["flores", "naturaleza"]),
    ("frog", 1, "hama", "noa", "Rana contenta", ["naturaleza", "kawaii"]),
    ("plant", 1, "cross_stitch", "ivan", "Planta de interior", ["naturaleza", "flores"]),
    ("star", 1, "hama", "alma", "Estrella fugaz", ["pixelart", "retro", "navidad"]),
    ("heart", 2, "cross_stitch", "xiana", "Corazón doble ancho", ["kawaii", "flores"]),
    ("cat", 1, "cross_stitch", "hugo", "Gato gótico", ["gato", "retro"]),
    ("mushroom", 2, "cross_stitch", "breogan", "Seta gigante", ["naturaleza", "comida"]),
    ("strawberry", 2, "hama", "mario", "Fresa XXL", ["comida", "kawaii"]),
    ("rainbow", 2, "cross_stitch", "lucia", "Arcoíris para coser", ["pixelart", "flores"]),
    ("ghost", 1, "hama", "ivan", "Fantasma pequeño", ["retro", "pixelart"]),
    ("smiley", 2, "cross_stitch", "noa", "Carita feliz", ["retro", "kawaii"]),
    ("flower", 1, "hama", "alma", "Flor rosa", ["flores", "kawaii"]),
    ("frog", 1, "cross_stitch", "xiana", "Rana de estanque", ["naturaleza", "retro"]),
    ("plant", 2, "hama", "hugo", "Cactus de compañía", ["naturaleza", "pixelart"]),
    ("star", 2, "cross_stitch", "breogan", "Estrella grande", ["pixelart", "navidad", "naturaleza"]),
    ("heart", 1, "hama", "ivan", "Corazón mini", ["kawaii", "flores"]),
    ("cat", 2, "hama", "mario", "Gato de pared", ["gato", "kawaii"]),
    ("mushroom", 1, "hama", "noa", "Setas de otoño", ["naturaleza", "comida"]),
    ("strawberry", 1, "cross_stitch", "alma", "Fresa bordada", ["comida", "flores"]),
    ("rainbow", 2, "hama", "xiana", "Arcoíris de pared", ["pixelart", "kawaii"]),
    ("ghost", 2, "cross_stitch", "lucia", "Fantasma de Halloween", ["retro", "pixelart"]),
    ("flower", 2, "cross_stitch", "breogan", "Flor silvestre", ["flores", "naturaleza"]),
    ("frog", 2, "hama", "hugo", "Rana saltarina", ["naturaleza", "kawaii"]),
]

COMMENTS = [
    "¡Qué chulo! Quiero hacerlo ya",
    "Los colores quedan genial",
    "Necesito el patrón para mi sobrina",
    "Me encanta cómo queda en HAMA",
    "Esto va directo a la pared de mi cuarto",
    "¿Cuántas cuentas llevas?",
    "El detalle de los ojos es brutal",
    "Yo lo haría más grande, pero está increíble",
    "Guardado para el finde",
    "Qué bien queda el punto de cruz",
    "Muy limpio el diseño",
    "Me recuerda a los patrones de antes",
]


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _build_pattern(design_key: str, craft: str, scale: int) -> PatternData:
    design = DESIGNS[design_key]
    rows: list[str] = design["rows"]
    widths = {len(row) for row in rows}
    if len(widths) != 1:
        raise ValueError(f"Filas de distinto ancho en el diseño {design_key!r}: {widths}")

    char_to_role: dict[str, str] = design["chars"]
    roles_in_order: list[str] = []
    for row in rows:
        for char in row:
            if char == ".":
                continue
            role = char_to_role.get(char)
            if role is None:
                raise ValueError(f"Carácter sin rol {char!r} en {design_key!r}")
            if role not in roles_in_order:
                roles_in_order.append(role)

    ids = HAMA_IDS if craft == "hama" else DMC_IDS
    palette = []
    for index, role in enumerate(roles_in_order):
        name, hex_color = ROLE_INFO[role]
        palette.append(
            {
                "id": ids[role],
                "name": name,
                "hex": hex_color,
                "symbol": chr(ord("A") + index) if craft == "cross_stitch" else None,
            }
        )

    role_to_index = {role: index for index, role in enumerate(roles_in_order)}
    scaled_rows = [row * scale for row in rows for _ in range(scale)]
    cells = [
        -1 if char == "." else role_to_index[char_to_role[char]]
        for row in scaled_rows
        for char in row
    ]

    return PatternData(
        craft=craft,  # type: ignore[arg-type]
        width=len(scaled_rows[0]),
        height=len(scaled_rows),
        palette=palette,  # type: ignore[arg-type]
        cells=cells,
    )


def _reset_database() -> None:
    engine.dispose()
    if DATABASE_URL.startswith("sqlite:///"):
        path = Path(DATABASE_URL.removeprefix("sqlite:///"))
        if path.exists():
            path.unlink()
    init_db()


def _seed_users(session: Session) -> dict[str, models.User]:
    password_hash = hash_password(DEMO_PASSWORD)
    now = datetime.now(timezone.utc)
    users: dict[str, models.User] = {}
    for index, (username, display_name, bio) in enumerate(USERS):
        user = models.User(
            username=username,
            email=f"{username}@demo.pixelpattern.app",
            password_hash=password_hash,
            display_name=display_name,
            bio=bio,
            created_at=now - timedelta(days=40 - index),
        )
        session.add(user)
        users[username] = user
    session.commit()
    for user in users.values():
        session.refresh(user)
    return users


def _seed_follows(session: Session, users: dict[str, models.User]) -> None:
    now = datetime.now(timezone.utc)
    for index, (follower, followee) in enumerate(FOLLOWS):
        session.add(
            models.Follow(
                follower_id=users[follower].id,
                followee_id=users[followee].id,
                created_at=now - timedelta(days=20, hours=index),
            )
        )
    session.commit()


def _seed_posts(session: Session, users: dict[str, models.User]) -> list[models.Post]:
    now = datetime.now(timezone.utc)
    posts: list[models.Post] = []
    for index, (design, scale, craft, author, title, tags) in enumerate(POSTS):
        pattern = _build_pattern(design, craft, scale)
        # Escalonado: del más antiguo (hace ~10 días) al más reciente.
        created_at = now - timedelta(days=9.8 - index * (9.6 / max(len(POSTS) - 1, 1)))
        post = models.Post(
            author_id=users[author].id,
            title=title,
            description=f"{title}. Patrón de {'HAMA' if craft == 'hama' else 'punto de cruz'} hecho a mano.",
            craft=craft,
            tags="," + ",".join(tags) + ",",
            pattern=pattern.model_dump(),
            width=pattern.width,
            height=pattern.height,
            colors_count=len(pattern.palette),
            created_at=created_at,
        )
        session.add(post)
        posts.append(post)
    session.commit()
    for post in posts:
        session.refresh(post)
    return posts


def _seed_likes(session: Session, users: dict[str, models.User], posts: list[models.Post]) -> None:
    rng = random.Random(SEED_RANDOM)
    usernames = list(users)
    for post in posts:
        candidates = [name for name in usernames if users[name].id != post.author_id]
        for name in rng.sample(candidates, rng.randint(1, 5)):
            session.add(
                models.Like(
                    user_id=users[name].id,
                    post_id=post.id,
                    created_at=post.created_at + timedelta(hours=rng.randint(1, 40)),
                )
            )
    session.commit()


def _seed_comments(
    session: Session, users: dict[str, models.User], posts: list[models.Post]
) -> None:
    rng = random.Random(SEED_RANDOM + 1)
    usernames = list(users)
    for post in posts:
        candidates = [name for name in usernames if users[name].id != post.author_id]
        for name in rng.sample(candidates, rng.randint(0, 3)):
            session.add(
                models.Comment(
                    post_id=post.id,
                    user_id=users[name].id,
                    text=rng.choice(COMMENTS),
                    created_at=post.created_at + timedelta(hours=rng.randint(2, 60)),
                )
            )
    session.commit()


def _seed_assets(session: Session, users: dict[str, models.User]) -> int:
    """Convierte imágenes de backend/seed_assets/ si Persona 2 xa expón o motor."""
    assets_dir = BASE_DIR / "seed_assets"
    if not assets_dir.is_dir():
        return 0
    try:
        from .engine.convert import convert_image  # type: ignore[attr-defined]
    except Exception:
        return 0

    images = sorted(
        path for path in assets_dir.iterdir()
        if path.suffix.lower() in IMAGE_EXTENSIONS
    )
    authors = list(users)
    created = 0
    for index, path in enumerate(images):
        try:
            result = convert_image(path.read_bytes(), craft="hama", width=29)
            pattern = PatternData.model_validate(
                result if isinstance(result, dict) else result.model_dump()
            )
        except Exception:
            continue
        author = users[authors[index % len(authors)]]
        post = models.Post(
            author_id=author.id,
            title=path.stem.replace("_", " ").replace("-", " ").title(),
            description="Convertido automáticamente desde seed_assets.",
            craft=pattern.craft,
            tags=",pixelart,",
            pattern=pattern.model_dump(),
            width=pattern.width,
            height=pattern.height,
            colors_count=len(pattern.palette),
            created_at=datetime.now(timezone.utc) - timedelta(hours=index),
        )
        session.add(post)
        created += 1
    session.commit()
    return created


def main() -> None:
    parser = argparse.ArgumentParser(description="Datos de demo de Pixel Pattern")
    parser.add_argument(
        "--reset", action="store_true", help="borra app.db y vuelve a sembrar"
    )
    args = parser.parse_args()

    if args.reset:
        _reset_database()
    else:
        init_db()

    with Session(engine) as session:
        if session.exec(select(models.User)).first() is not None:
            print("La base de datos ya tiene datos. Usa --reset para recrearla.")
            return

        users = _seed_users(session)
        _seed_follows(session, users)
        posts = _seed_posts(session, users)
        _seed_likes(session, users, posts)
        _seed_comments(session, users, posts)
        extra = _seed_assets(session, users)

    print(
        f"Listo: {len(users)} usuarios, {len(posts)} posts"
        + (f", {extra} convertidos de seed_assets" if extra else "")
        + f". Contraseña demo: {DEMO_PASSWORD}"
    )


if __name__ == "__main__":
    main()
