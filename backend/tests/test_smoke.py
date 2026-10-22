def test_health(client):
    assert client.get("/api/health").json() == {"ok": True}


def test_me_with_token(client, make_user):
    headers = make_user("ana")
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "ana"


def test_me_without_token(client):
    assert client.get("/api/auth/me").status_code == 401
