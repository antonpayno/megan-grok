"""Tests de auth, perfiles y follows (Persona 1)."""
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

import pytest
from PIL import Image
from sqlmodel import select

from app import models


def _user(session, username: str) -> models.User:
    return session.exec(select(models.User).where(models.User.username == username)).one()


def _add_post(session, author: models.User, title: str = "Patrón") -> models.Post:
    post = models.Post(
        author_id=author.id,
        title=title,
        craft="hama",
        pattern={"craft": "hama", "width": 1, "height": 1, "palette": [], "cells": [-1]},
        width=1,
        height=1,
        colors_count=0,
    )
    session.add(post)
    session.commit()
    return post


def _add_follow(session, follower: models.User, followee: models.User, days: int = 0):
    session.add(
        models.Follow(
            follower_id=follower.id,
            followee_id=followee.id,
            created_at=datetime.now(timezone.utc) - timedelta(days=days),
        )
    )
    session.commit()


# ---------- register ----------

def test_register_normaliza_y_devuelve_token(client, session):
    r = client.post(
        "/api/auth/register",
        json={"username": "Ana_P", "email": "Ana@Test.COM", "password": "secreto1"},
    )

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["username"] == "ana_p"
    assert body["user"]["display_name"] == "ana_p"  # por defecto = username
    assert "email" not in body["user"] and "password_hash" not in body["user"]

    stored = _user(session, "ana_p")
    assert stored.email == "ana@test.com"


def test_register_usa_display_name_recortado(client):
    r = client.post(
        "/api/auth/register",
        json={
            "username": "bea",
            "email": "bea@test.com",
            "password": "secreto1",
            "display_name": "  Bea  ",
        },
    )

    assert r.status_code == 201
    assert r.json()["user"]["display_name"] == "Bea"


@pytest.mark.parametrize("username,email", [("ana", "ana@test.com"), ("ANA", "otro@test.com")])
def test_register_usuario_duplicado_409(client, make_user, username, email):
    make_user("ana")

    r = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": "secreto1"},
    )

    assert r.status_code == 409
    assert r.json()["detail"] == "Ese usuario ya existe"


def test_register_email_duplicado_409(client, make_user):
    make_user("ana")  # ana@test.com

    r = client.post(
        "/api/auth/register",
        json={"username": "otra", "email": "ANA@test.com", "password": "secreto1"},
    )

    assert r.status_code == 409
    assert r.json()["detail"] == "Ese email ya está registrado"


def test_register_email_invalido_400(client):
    r = client.post(
        "/api/auth/register",
        json={"username": "ana", "email": "no-es-email", "password": "secreto1"},
    )

    assert r.status_code == 400
    assert r.json()["detail"] == "Ese email no es válido"


# ---------- login ----------

@pytest.mark.parametrize("identifier", ["ana", "ANA", "ana@test.com", " Ana@Test.com "])
def test_login_por_username_o_email(client, make_user, identifier):
    make_user("ana")

    r = client.post(
        "/api/auth/login",
        json={"username_or_email": identifier, "password": "secret123"},
    )

    assert r.status_code == 200, r.text
    assert r.json()["user"]["username"] == "ana"


@pytest.mark.parametrize(
    "payload",
    [
        {"username_or_email": "ana", "password": "mala"},
        {"username_or_email": "nadie", "password": "secret123"},
    ],
)
def test_login_incorrecto_401(client, make_user, payload):
    make_user("ana")

    r = client.post("/api/auth/login", json=payload)

    assert r.status_code == 401
    assert r.json()["detail"] == "Usuario o contraseña incorrectos"


# ---------- perfil ----------

def test_perfil_con_contadores(client, session, make_user):
    make_user("ana")
    make_user("bea")
    make_user("carla")
    ana, bea = _user(session, "ana"), _user(session, "bea")
    _add_post(session, ana)
    _add_post(session, ana, title="Otro")
    _add_follow(session, bea, ana)
    _add_follow(session, _user(session, "carla"), ana)

    r = client.get("/api/users/ana")

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["followers_count"] == 2
    assert body["following_count"] == 0
    assert body["posts_count"] == 2
    assert body["is_me"] is False
    assert body["is_following"] is False
    assert "email" not in body and "password_hash" not in body


def test_perfil_is_following_y_is_me(client, make_user, session):
    headers = make_user("ana")
    make_user("bea")
    ana, bea = _user(session, "ana"), _user(session, "bea")
    _add_follow(session, ana, bea)

    propio = client.get("/api/users/ana", headers=headers).json()
    alleo = client.get("/api/users/bea", headers=headers).json()

    assert propio["is_me"] is True
    assert propio["is_following"] is False
    assert alleo["is_me"] is False
    assert alleo["is_following"] is True


def test_perfil_inexistente_404(client):
    r = client.get("/api/users/nadie")

    assert r.status_code == 404
    assert r.json()["detail"] == "Usuario no encontrado"


# ---------- PATCH /me ----------

def test_patch_me_recorta_y_actualiza(client, session, make_user):
    headers = make_user("ana")

    r = client.patch(
        "/api/users/me",
        headers=headers,
        json={"display_name": "  Ana  ", "bio": "  Hago patrones  "},
    )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["display_name"] == "Ana"
    assert body["bio"] == "Hago patrones"
    assert body["is_me"] is True

    stored = _user(session, "ana")
    assert stored.display_name == "Ana"
    assert stored.bio == "Hago patrones"


def test_patch_me_bio_demasiado_larga_400(client, make_user):
    headers = make_user("ana")

    r = client.patch("/api/users/me", headers=headers, json={"bio": "x" * 301})

    assert r.status_code == 400
    assert "300" in r.json()["detail"]


def test_patch_me_sin_sesion_401(client):
    r = client.patch("/api/users/me", json={"bio": "hola"})

    assert r.status_code == 401


# ---------- follow / unfollow ----------

def test_follow_es_idempotente(client, make_user):
    headers = make_user("ana")
    make_user("bea")

    primera = client.post("/api/users/bea/follow", headers=headers)
    segunda = client.post("/api/users/bea/follow", headers=headers)

    assert primera.status_code == 200
    assert segunda.status_code == 200
    assert primera.json() == {"following": True, "followers_count": 1}
    assert segunda.json() == {"following": True, "followers_count": 1}


def test_unfollow_es_idempotente(client, make_user):
    headers = make_user("ana")
    make_user("bea")
    client.post("/api/users/bea/follow", headers=headers)

    primera = client.delete("/api/users/bea/follow", headers=headers)
    segunda = client.delete("/api/users/bea/follow", headers=headers)

    assert primera.status_code == 200
    assert primera.json() == {"following": False, "followers_count": 0}
    assert segunda.json() == {"following": False, "followers_count": 0}


def test_no_puedes_seguirte_a_ti_mismo(client, make_user):
    headers = make_user("ana")

    r = client.post("/api/users/ana/follow", headers=headers)

    assert r.status_code == 400
    assert r.json()["detail"] == "No puedes seguirte a ti mismo"


def test_follow_usuario_inexistente_404(client, make_user):
    headers = make_user("ana")

    r = client.post("/api/users/nadie/follow", headers=headers)

    assert r.status_code == 404


# ---------- followers / following ----------

def test_followers_y_following_mas_recientes_primero(client, session, make_user):
    make_user("ana")
    ana = _user(session, "ana")
    for name in ("bea", "carla", "dani"):
        make_user(name)

    _add_follow(session, _user(session, "bea"), ana, days=3)
    _add_follow(session, _user(session, "dani"), ana, days=1)
    _add_follow(session, _user(session, "carla"), ana, days=2)
    _add_follow(session, ana, _user(session, "bea"), days=1)

    followers = client.get("/api/users/ana/followers")
    following = client.get("/api/users/ana/following")

    assert followers.status_code == 200
    assert [u["username"] for u in followers.json()] == ["dani", "carla", "bea"]
    assert [u["username"] for u in following.json()] == ["bea"]
    assert set(followers.json()[0]) == {"id", "username", "display_name", "avatar_url"}


# ---------- seed ----------

def test_seed_patrones_validos_y_en_rango():
    from app import seed

    assert len(seed.USERS) == 8
    assert len(seed.POSTS) == 30
    assert {u[0] for u in seed.USERS} == {p[3] for p in seed.POSTS}

    for design, scale, craft, author, title, tags in seed.POSTS:
        pattern = seed._build_pattern(design, craft, scale)
        assert pattern.craft == craft
        assert 12 <= pattern.width <= 40
        assert 12 <= pattern.height <= 40
        assert len(pattern.cells) == pattern.width * pattern.height
        assert 1 <= len(pattern.palette) <= 64
        assert 1 <= len(tags) <= 10


def test_seed_escala_duplica_cada_celda():
    from app import seed

    pattern = seed._build_pattern("frog", "hama", 2)
    width = pattern.width

    # Cada celda del diseño original debe ocupar un bloque 2x2, no repetir
    # la fila entera al lado (eso deformaba el patrón).
    for y in range(0, pattern.height, 2):
        for x in range(0, width, 2):
            block = {
                pattern.cells[y * width + x],
                pattern.cells[y * width + x + 1],
                pattern.cells[(y + 1) * width + x],
                pattern.cells[(y + 1) * width + x + 1],
            }
            assert len(block) == 1


def test_seed_usa_ids_de_paletas_reales():
    from app import seed

    hama = seed._build_pattern("heart", "hama", 1)
    dmc = seed._build_pattern("heart", "cross_stitch", 1)

    assert hama.palette[0].id == "H11"  # Rosa Hama
    assert dmc.palette[0].id == "605"  # Rosa DMC
    assert hama.palette[0].hex == dmc.palette[0].hex == "#FF5D8F"


# ---------- casos límite ----------

@pytest.mark.parametrize(
    "payload",
    [
        {"username": "ab", "email": "ab@test.com", "password": "secreto1"},
        {"username": "a b", "email": "ab@test.com", "password": "secreto1"},
        {"username": "ana", "email": "ana@test.com", "password": "123"},
    ],
)
def test_register_payload_invalido_422(client, payload):
    assert client.post("/api/auth/register", json=payload).status_code == 422


def test_patch_me_display_name_vacio_400(client, make_user):
    headers = make_user("ana")

    r = client.patch("/api/users/me", headers=headers, json={"display_name": "   "})

    assert r.status_code == 400


def test_patch_me_actualiza_avatar_url_recortada(client, make_user):
    headers = make_user("ana")

    r = client.patch(
        "/api/users/me", headers=headers, json={"avatar_url": "  /media/x.png  "}
    )

    assert r.status_code == 200
    assert r.json()["avatar_url"] == "/media/x.png"


def test_follow_y_avatar_sen_sesion_401(client, make_user):
    make_user("ana")

    assert client.post("/api/users/ana/follow").status_code == 401
    assert client.delete("/api/users/ana/follow").status_code == 401
    assert (
        client.post(
            "/api/users/me/avatar", files={"file": ("a.png", b"x", "image/png")}
        ).status_code
        == 401
    )


def test_avatar_recorta_o_cadrado_centrado(client, make_user, monkeypatch, tmp_path):
    import app.routers.users as users_router

    monkeypatch.setattr(users_router, "MEDIA_DIR", tmp_path)
    headers = make_user("ana")

    source = Image.new("RGB", (300, 100), (255, 0, 0))
    source.paste((0, 255, 0), (100, 0, 200, 100))
    source.paste((0, 0, 255), (200, 0, 300, 100))
    buffer = BytesIO()
    source.save(buffer, format="PNG")

    r = client.post(
        "/api/users/me/avatar",
        headers=headers,
        files={"file": ("bandas.png", buffer.getvalue(), "image/png")},
    )

    assert r.status_code == 200
    stored = tmp_path / "avatars" / f"{r.json()['id']}.png"
    with Image.open(stored) as saved:
        assert saved.size == (256, 256)
        assert saved.getpixel((128, 128)) == (0, 255, 0)


def test_followers_devolve_como_moito_100(client, session, make_user):
    make_user("ana")
    ana = _user(session, "ana")
    now = datetime.now(timezone.utc)

    fans = []
    for index in range(105):
        fan = models.User(
            username=f"fan{index:03d}",
            email=f"fan{index:03d}@test.com",
            password_hash="x",
            display_name=f"Fan {index}",
        )
        session.add(fan)
        fans.append(fan)
    session.commit()
    for index, fan in enumerate(fans):
        session.refresh(fan)
        session.add(
            models.Follow(
                follower_id=fan.id,
                followee_id=ana.id,
                created_at=now - timedelta(minutes=index),
            )
        )
    session.commit()

    r = client.get("/api/users/ana/followers")

    assert r.status_code == 200
    usernames = [u["username"] for u in r.json()]
    assert len(usernames) == 100
    assert usernames[0] == "fan000"  # el más reciente
    assert usernames[-1] == "fan099"
    assert "fan104" not in usernames


# ---------- avatar ----------

def _png_bytes(size: tuple[int, int] = (640, 480)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (200, 30, 60)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_avatar_redimensiona_y_guarda(client, make_user, monkeypatch, tmp_path):
    import app.routers.users as users_router

    monkeypatch.setattr(users_router, "MEDIA_DIR", tmp_path)
    headers = make_user("ana")

    r = client.post(
        "/api/users/me/avatar",
        headers=headers,
        files={"file": ("foto.png", _png_bytes(), "image/png")},
    )

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["avatar_url"].startswith(f"/media/avatars/{body['id']}.png?v=")

    stored = tmp_path / "avatars" / f"{body['id']}.png"
    assert stored.exists()
    with Image.open(stored) as saved:
        assert saved.size == (256, 256)


def test_avatar_rechaza_no_imaxe(client, make_user, monkeypatch, tmp_path):
    import app.routers.users as users_router

    monkeypatch.setattr(users_router, "MEDIA_DIR", tmp_path)
    headers = make_user("ana")

    r = client.post(
        "/api/users/me/avatar",
        headers=headers,
        files={"file": ("nota.txt", b"isto non e unha imaxe", "text/plain")},
    )

    assert r.status_code == 400
    assert r.json()["detail"] == "El archivo no es una imagen válida"


def test_avatar_rechaza_mais_de_5mb(client, make_user, monkeypatch, tmp_path):
    import app.routers.users as users_router

    monkeypatch.setattr(users_router, "MEDIA_DIR", tmp_path)
    headers = make_user("ana")

    r = client.post(
        "/api/users/me/avatar",
        headers=headers,
        files={"file": ("grande.png", b"0" * (5 * 1024 * 1024 + 1), "image/png")},
    )

    assert r.status_code == 400
    assert r.json()["detail"] == "La imagen no puede superar 5 MB"


# ---------- seed (integración con proceso real) ----------

def test_seed_reset_e_idempotente(tmp_path):
    backend = Path(__file__).resolve().parents[1]
    db_path = tmp_path / "seed.db"
    env = {
        **os.environ,
        "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
        "PYTHONIOENCODING": "utf-8",
    }

    first = subprocess.run(
        [sys.executable, "-m", "app.seed", "--reset"],
        cwd=backend,
        env=env,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert first.returncode == 0, first.stderr
    assert "8 usuarios" in first.stdout
    assert "30 posts" in first.stdout
    assert db_path.exists() and db_path.stat().st_size > 0

    second = subprocess.run(
        [sys.executable, "-m", "app.seed"],
        cwd=backend,
        env=env,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert second.returncode == 0, second.stderr
    assert "ya tiene datos" in second.stdout

    third = subprocess.run(
        [sys.executable, "-m", "app.seed", "--reset"],
        cwd=backend,
        env=env,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    assert third.returncode == 0, third.stderr
    assert "8 usuarios" in third.stdout
