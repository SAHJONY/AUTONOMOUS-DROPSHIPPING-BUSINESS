def test_register_login_me(client):
    resp = client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123",
            "full_name": "Test User",
            "organization_name": "Test Org",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["access_token"]

    resp = client.post(
        "/auth/login", json={"email": "user@example.com", "password": "password123"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "user@example.com"


def test_duplicate_email_rejected(client):
    body = {"email": "dupe@example.com", "password": "password123"}
    assert client.post("/auth/register", json=body).status_code == 201
    assert client.post("/auth/register", json=body).status_code == 409


def test_wrong_password_rejected(client):
    client.post("/auth/register", json={"email": "a@example.com", "password": "password123"})
    resp = client.post("/auth/login", json={"email": "a@example.com", "password": "wrongpass1"})
    assert resp.status_code == 401


def test_me_requires_token(client):
    assert client.get("/auth/me").status_code == 401


def test_org_isolation(client):
    client.post("/auth/register", json={"email": "one@example.com", "password": "password123"})
    token1 = client.post(
        "/auth/login", json={"email": "one@example.com", "password": "password123"}
    ).json()["access_token"]
    org1 = client.get("/orgs", headers={"Authorization": f"Bearer {token1}"}).json()[0]["id"]

    client.post("/auth/register", json={"email": "two@example.com", "password": "password123"})
    token2 = client.post(
        "/auth/login", json={"email": "two@example.com", "password": "password123"}
    ).json()["access_token"]

    resp = client.get(f"/orgs/{org1}", headers={"Authorization": f"Bearer {token2}"})
    assert resp.status_code == 404
