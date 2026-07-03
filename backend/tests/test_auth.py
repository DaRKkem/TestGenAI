def test_register_success(client):
    response = client.post("/auth/register", json={
        "email": "new@example.com",
        "password": "StrongPass123!"
    })
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
    assert "id" in response.json()


def test_register_duplicate_email(client, registered_user):
    response = client.post("/auth/register", json=registered_user)
    assert response.status_code == 409


def test_register_weak_password(client):
    response = client.post("/auth/register", json={
        "email": "weak@example.com",
        "password": "short"
    })
    assert response.status_code == 422


def test_register_missing_uppercase(client):
    response = client.post("/auth/register", json={
        "email": "weak2@example.com",
        "password": "nouppercase123!"
    })
    assert response.status_code == 422


def test_login_success(client, registered_user):
    response = client.post("/auth/login", data={
        "username": registered_user["email"],
        "password": registered_user["password"]
    })
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_wrong_password(client, registered_user):
    response = client.post("/auth/login", data={
        "username": registered_user["email"],
        "password": "WrongPass123!"
    })
    assert response.status_code == 401


def test_login_nonexistent_user(client):
    response = client.post("/auth/login", data={
        "username": "ghost@example.com",
        "password": "StrongPass123!"
    })
    assert response.status_code == 401