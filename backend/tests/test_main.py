def test_root_health_check(client):
    """Vérifie que l'API répond correctement sur la route racine."""
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["app"] == "TestGen AI"