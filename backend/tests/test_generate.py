from unittest.mock import patch, AsyncMock


def test_generate_requires_auth(client):
    """Sans token, la route doit renvoyer 401."""
    response = client.post("/generate", json={
        "source_code": "def add(a,b): return a+b",
        "language": "python"
    })
    assert response.status_code == 401


def test_generate_success(client, auth_headers):
    """Génération réussie : vérifie le status 200 et le contenu retourné."""
    fake_result = {
        "test_code": "def test_add(): assert add(1,2)==3",
        "provider": "mistral"
    }

    with patch("app.routes.generate.generate_tests", new=AsyncMock(return_value=fake_result)):
        response = client.post("/generate", json={
            "source_code": "def add(a,b): return a+b",
            "language": "python"
        }, headers=auth_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["test_code"] == fake_result["test_code"]
    assert body["llm_provider"] == "mistral"
    assert body["status"] == "success"
    assert "snippet_id" in body


def test_generate_llm_failure(client, auth_headers):
    """Si tous les LLM providers échouent, la route doit renvoyer 502."""
    with patch(
        "app.routes.generate.generate_tests",
        new=AsyncMock(side_effect=Exception("All LLM providers are currently unavailable."))
    ):
        response = client.post("/generate", json={
            "source_code": "def add(a,b): return a+b",
            "language": "python"
        }, headers=auth_headers)

    assert response.status_code == 502
    assert "All LLM providers failed" in response.json()["detail"]


def test_generate_deduplication(client, auth_headers):
    """
    Si le même code est soumis deux fois par le même user,
    la deuxième requête doit renvoyer le résultat déjà stocké
    SANS rappeler le LLM une deuxième fois.
    """
    fake_result = {
        "test_code": "def test_add(): assert add(1,2)==3",
        "provider": "mistral"
    }
    payload = {
        "source_code": "def add(a,b): return a+b",
        "language": "python"
    }

    with patch("app.routes.generate.generate_tests", new=AsyncMock(return_value=fake_result)) as mock_llm:
        # Premier appel : doit appeler le LLM
        first = client.post("/generate", json=payload, headers=auth_headers)
        assert first.status_code == 200
        assert mock_llm.call_count == 1

        # Deuxième appel avec le même code : doit renvoyer le cache, pas rappeler le LLM
        second = client.post("/generate", json=payload, headers=auth_headers)
        assert second.status_code == 200
        assert mock_llm.call_count == 1  # toujours 1, pas 2

    assert first.json()["snippet_id"] == second.json()["snippet_id"]


def test_generate_missing_fields(client, auth_headers):
    """Sans source_code ou language, doit renvoyer 422 (validation Pydantic)."""
    response = client.post("/generate", json={
        "source_code": "def add(a,b): return a+b"
        # language manquant
    }, headers=auth_headers)
    assert response.status_code == 422