"""Tests de posts, feed y búsqueda (Persona 3)."""
from sqlalchemy import func
from sqlmodel import select

from app.models import Comment, Follow, Like, Post, Save, User


def make_pattern(width=2, height=2, cells=None, craft="hama", palette=None):
    if cells is None:
        cells = [0] * (width * height)
    if palette is None:
        palette = [{"id": "H01", "name": "Blanco", "hex": "#FFFFFF"}]
    return {
        "craft": craft,
        "width": width,
        "height": height,
        "palette": palette,
        "cells": cells,
    }


def create_post(client, headers, **overrides):
    payload = {
        "title": "Corazón",
        "description": "Un corazón kawaii",
        "tags": ["#Kawaii", "Gato"],
        "pattern": make_pattern(),
    }
    payload.update(overrides)
    return client.post("/api/posts", json=payload, headers=headers)


def user_id(session, username):
    return session.exec(select(User).where(User.username == username)).one().id


def count_rows(session, model, **filters):
    stmt = select(func.count()).select_from(model)
    for field, value in filters.items():
        stmt = stmt.where(getattr(model, field) == value)
    return session.exec(stmt).one()


def test_crear_post_normaliza_tags_y_cuenta_colores(client, session, make_user):
    headers = make_user("ana")

    r = create_post(
        client,
        headers,
        tags=["#Kawaii", " Gato ", "kawaii", "x" * 31],
        pattern=make_pattern(cells=[0, -1, 0, 0]),
    )

    assert r.status_code == 201
    body = r.json()
    assert body["tags"] == ["kawaii", "gato"]
    assert body["craft"] == "hama"
    assert body["width"] == 2
    assert body["height"] == 2
    assert body["colors_count"] == 1
    assert body["pattern"]["cells"] == [0, -1, 0, 0]
    assert body["likes_count"] == 0
    assert body["comments_count"] == 0
    assert body["liked_by_me"] is False
    assert body["saved_by_me"] is False
    assert body["author"]["username"] == "ana"
    assert "email" not in body["author"]
    assert "password_hash" not in body["author"]

    stored = session.get(Post, body["id"])
    assert stored.tags == ",kawaii,gato,"


def test_crear_post_cells_de_longitud_incorrecta_422(client, make_user):
    headers = make_user("ana")
    r = create_post(client, headers, pattern=make_pattern(width=2, height=2, cells=[0, 0, 0]))
    assert r.status_code == 422


def test_crear_post_sin_sesion_401(client):
    assert create_post(client, {}).status_code == 401


def test_crear_post_con_remix_inexistente_404(client, make_user):
    assert create_post(client, make_user("ana"), remix_of=9999).status_code == 404


def test_feed_explore_pagina_con_cursor(client, make_user):
    headers = make_user("ana")
    for i in range(25):
        assert create_post(client, headers, title=f"Patrón {i}").status_code == 201

    seen: list[int] = []
    cursor = None
    pages = 0
    while True:
        url = "/api/posts/feed?mode=explore&limit=10"
        if cursor is not None:
            url += f"&cursor={cursor}"
        r = client.get(url)
        assert r.status_code == 200
        page = r.json()
        seen.extend(post["id"] for post in page["items"])
        pages += 1
        cursor = page["next_cursor"]
        if cursor is None:
            break

    assert pages == 3
    assert len(seen) == 25
    assert len(set(seen)) == 25
    assert seen == sorted(seen, reverse=True)


def test_feed_following_incluye_seguidos_y_propios(client, session, make_user):
    ana = make_user("ana")
    luis = make_user("luis")
    eva = make_user("eva")

    ana_post = create_post(client, ana, title="De Ana").json()["id"]
    luis_post_1 = create_post(client, luis, title="Luis 1").json()["id"]
    luis_post_2 = create_post(client, luis, title="Luis 2").json()["id"]
    eva_post = create_post(client, eva, title="De Eva").json()["id"]

    session.add(Follow(follower_id=user_id(session, "ana"), followee_id=user_id(session, "luis")))
    session.commit()

    r = client.get("/api/posts/feed?mode=following&limit=50", headers=ana)
    assert r.status_code == 200
    ids = {post["id"] for post in r.json()["items"]}
    assert ids == {ana_post, luis_post_1, luis_post_2}
    assert eva_post not in ids

    assert client.get("/api/posts/feed?mode=following").status_code == 401


def test_like_idempotente_y_contador(client, make_user):
    ana = make_user("ana")
    luis = make_user("luis")
    post_id = create_post(client, ana).json()["id"]

    first = client.post(f"/api/posts/{post_id}/like", headers=luis)
    second = client.post(f"/api/posts/{post_id}/like", headers=luis)
    assert first.status_code == 200
    assert first.json() == {"liked": True, "likes_count": 1}
    assert second.json() == {"liked": True, "likes_count": 1}

    assert client.get(f"/api/posts/{post_id}", headers=luis).json()["liked_by_me"] is True
    assert client.get(f"/api/posts/{post_id}", headers=ana).json()["liked_by_me"] is False

    assert client.delete(f"/api/posts/{post_id}/like", headers=luis).json() == {
        "liked": False,
        "likes_count": 0,
    }
    assert client.delete(f"/api/posts/{post_id}/like", headers=luis).json() == {
        "liked": False,
        "likes_count": 0,
    }
    assert client.post("/api/posts/9999/like", headers=luis).status_code == 404


def test_save_idempotente_y_listado(client, make_user):
    ana = make_user("ana")
    luis = make_user("luis")
    post_id = create_post(client, ana).json()["id"]

    assert client.post(f"/api/posts/{post_id}/save", headers=luis).json() == {"saved": True}
    assert client.post(f"/api/posts/{post_id}/save", headers=luis).json() == {"saved": True}

    saved = client.get("/api/posts/saved", headers=luis)
    assert saved.status_code == 200
    page = saved.json()
    assert [post["id"] for post in page["items"]] == [post_id]
    assert page["items"][0]["saved_by_me"] is True
    assert page["next_cursor"] is None

    assert client.get("/api/posts/saved").status_code == 401
    assert client.delete(f"/api/posts/{post_id}/save", headers=luis).json() == {"saved": False}
    assert client.delete(f"/api/posts/{post_id}/save", headers=luis).json() == {"saved": False}
    assert client.get("/api/posts/saved", headers=luis).json()["items"] == []


def test_borrar_post_ajeno_403_y_propio_limpia_relaciones(client, session, make_user):
    ana = make_user("ana")
    luis = make_user("luis")
    post_id = create_post(client, ana).json()["id"]
    remix_id = create_post(client, luis, title="Remix", remix_of=post_id).json()["id"]

    client.post(f"/api/posts/{post_id}/like", headers=luis)
    client.post(f"/api/posts/{post_id}/save", headers=luis)
    client.post(f"/api/posts/{post_id}/comments", json={"text": "qué bonito"}, headers=luis)

    assert client.delete(f"/api/posts/{post_id}", headers=luis).status_code == 403
    assert client.delete(f"/api/posts/{post_id}", headers=ana).status_code == 204
    assert client.get(f"/api/posts/{post_id}").status_code == 404

    session.expire_all()
    assert count_rows(session, Like, post_id=post_id) == 0
    assert count_rows(session, Save, post_id=post_id) == 0
    assert count_rows(session, Comment, post_id=post_id) == 0
    assert session.get(Post, remix_id).remix_of is None


def test_filtros_author_tag_y_craft(client, make_user):
    ana = make_user("ana")
    hama = create_post(client, ana, tags=["Gato"]).json()
    cross = create_post(
        client, ana, title="Cruz", tags=["Flor"], pattern=make_pattern(craft="cross_stitch")
    ).json()

    by_tag = client.get("/api/posts?tag=GATO")
    assert by_tag.status_code == 200
    assert [post["id"] for post in by_tag.json()["items"]] == [hama["id"]]

    by_craft = client.get("/api/posts?craft=cross_stitch")
    assert [post["id"] for post in by_craft.json()["items"]] == [cross["id"]]

    by_author = client.get("/api/posts?author=ana")
    assert len(by_author.json()["items"]) == 2

    assert client.get("/api/posts?author=nadie").status_code == 404
    assert client.get("/api/posts?tag=noexiste").json()["items"] == []


def test_comentarios_recortados_y_ordenados(client, make_user):
    ana = make_user("ana")
    luis = make_user("luis")
    post_id = create_post(client, ana).json()["id"]

    first = client.post(
        f"/api/posts/{post_id}/comments", json={"text": "  primero  "}, headers=luis
    )
    second = client.post(
        f"/api/posts/{post_id}/comments", json={"text": "segundo"}, headers=ana
    )
    assert first.status_code == 201
    assert first.json()["text"] == "primero"
    assert second.status_code == 201

    listing = client.get(f"/api/posts/{post_id}/comments")
    assert listing.status_code == 200
    comments = listing.json()
    assert [comment["text"] for comment in comments] == ["primero", "segundo"]
    assert comments[0]["author"]["username"] == "luis"
    assert "email" not in comments[0]["author"]

    detail = client.get(f"/api/posts/{post_id}").json()
    assert detail["comments_count"] == 2

    assert (
        client.post(
            f"/api/posts/{post_id}/comments", json={"text": "   "}, headers=luis
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/posts/{post_id}/comments", json={"text": "x" * 501}, headers=luis
        ).status_code
        == 422
    )
    assert client.get("/api/posts/9999/comments").status_code == 404
    assert (
        client.post("/api/posts/9999/comments", json={"text": "hola"}, headers=luis).status_code
        == 404
    )


def test_get_post_inexistente_404(client):
    assert client.get("/api/posts/9999").status_code == 404
