from datetime import datetime, timezone
from app.models import Snippet, GeneratedTest, GenerationStatus


def _create_generation(db, user_id, source="def add(a,b): return a+b", test_code="def test_add(): pass"):
    """Helper : insère un snippet + generated_test directement en DB pour préparer les tests."""
    snippet = Snippet(user_id=user_id, language="python", source_code=source)
    db.add(snippet)
    db.commit()
    db.refresh(snippet)

    generated = GeneratedTest(
        snippet_id=snippet.id,
        test_code=test_code,
        llm_provider="mistral",
        status=GenerationStatus.success
    )
    db.add(generated)
    db.commit()
    db.refresh(generated)
    return snippet, generated


def _get_user_id(client, auth_headers):
    """Récupère l'id du user courant via un appel authentifié à /generate (indirect) —
    plus simple : on décode via /history qui ne renvoie rien mais confirme l'auth.
    On préfère ici récupérer l'id directement depuis la DB de test."""
    pass  # remplacé par la fixture db ci-dessous


# ---------------------------------------------------------------------------
# GET /history — liste
# ---------------------------------------------------------------------------
def test_get_history_requires_auth(client):
    response = client.get("/history")
    assert response.status_code == 401


def test_get_history_empty(client, auth_headers):
    response = client.get("/history", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_get_history_returns_user_entries(client, auth_headers, db_session, current_user):
    _create_generation(db_session, current_user.id)
    response = client.get("/history", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["language"] == "python"
    assert body[0]["status"] == "success"


def test_get_history_excludes_other_users(client, auth_headers, db_session, current_user):
    # Génération appartenant à un autre user (id bidon), ne doit pas apparaître
    _create_generation(db_session, user_id="some-other-user-id")
    response = client.get("/history", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


# ---------------------------------------------------------------------------
# GET /history/{id} — détail
# ---------------------------------------------------------------------------
def test_get_history_detail_success(client, auth_headers, db_session, current_user):
    snippet, generated = _create_generation(db_session, current_user.id)
    response = client.get(f"/history/{generated.id}", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == generated.id
    assert body["source_code"] == snippet.source_code
    assert body["test_code"] == generated.test_code


def test_get_history_detail_not_found(client, auth_headers):
    response = client.get("/history/nonexistent-id", headers=auth_headers)
    assert response.status_code == 404


def test_get_history_detail_forbidden(client, auth_headers, db_session):
    snippet, generated = _create_generation(db_session, user_id="another-user-id")
    response = client.get(f"/history/{generated.id}", headers=auth_headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /history/{id}
# ---------------------------------------------------------------------------
def test_delete_history_success(client, auth_headers, db_session, current_user):
    snippet, generated = _create_generation(db_session, current_user.id)
    response = client.delete(f"/history/{generated.id}", headers=auth_headers)
    assert response.status_code == 204

    # Vérifie que l'entrée a bien disparu
    check = client.get(f"/history/{generated.id}", headers=auth_headers)
    assert check.status_code == 404


def test_delete_history_not_found(client, auth_headers):
    response = client.delete("/history/nonexistent-id", headers=auth_headers)
    assert response.status_code == 404


def test_delete_history_forbidden(client, auth_headers, db_session):
    snippet, generated = _create_generation(db_session, user_id="another-user-id")
    response = client.delete(f"/history/{generated.id}", headers=auth_headers)
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# GET /history/download/{id}
# ---------------------------------------------------------------------------
def test_download_test_success(client, auth_headers, db_session, current_user):
    snippet, generated = _create_generation(db_session, current_user.id)
    response = client.get(f"/history/download/{generated.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/octet-stream"


def test_download_test_not_found(client, auth_headers):
    response = client.get("/history/download/nonexistent-id", headers=auth_headers)
    assert response.status_code == 404