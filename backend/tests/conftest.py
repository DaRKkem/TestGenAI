import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app, get_db
from app.models import Base
from app.models import User

# DB de test en mémoire, séparée de testgenai.db
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,  # garde la même connexion en mémoire entre les requêtes
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="function")
def client():
    """Crée les tables avant chaque test, les détruit après (isolation totale)."""
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def registered_user(client):
    """Crée un user et retourne ses identifiants."""
    payload = {"email": "test@example.com", "password": "StrongPass123!"}
    client.post("/auth/register", json=payload)
    return payload


@pytest.fixture
def auth_headers(client, registered_user):
    """Login et retourne les headers Authorization prêts à l'emploi."""
    response = client.post(
        "/auth/login",
        data={"username": registered_user["email"], "password": registered_user["password"]},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def db_session():
    """Donne un accès direct à la DB de test pour insérer des données de setup."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def current_user(db_session, registered_user):
    """Retourne l'objet User (SQLAlchemy) correspondant au user créé par registered_user."""
    return db_session.query(User).filter(User.email == registered_user["email"]).first()