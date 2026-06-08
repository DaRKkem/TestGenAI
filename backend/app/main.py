"""
TestGen AI — FastAPI application entry point.
Creates the database on startup and wires all routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base

# ---------------------------------------------------------------------------
# Database setup
# ---------------------------------------------------------------------------
DATABASE_URL = "sqlite:///./testgenai.db"

engine = create_engine(
    DATABASE_URL,
    # Required for SQLite when used across multiple threads (FastAPI is async)
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    Dependency injected into every route that needs a DB session.
    Ensures the session is always closed after the request, even on error.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TestGen AI",
    description="Generate unit tests from source code using an LLM.",
    version="0.1.0"
)

# Allow the vanilla JS frontend (served from a different origin during dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Create tables at startup (SQLite, no migration tool needed for MVP)
# ---------------------------------------------------------------------------
@app.on_event("startup")
def create_tables():
    """Create all SQLAlchemy tables if they don't exist yet."""
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# Routers  (imported here to avoid circular imports)
# ---------------------------------------------------------------------------
from app.routes import auth, generate, history  # noqa: E402

app.include_router(auth.router,     prefix="/auth",    tags=["auth"])
app.include_router(generate.router, prefix="",         tags=["generate"])
app.include_router(history.router,  prefix="/history", tags=["history"])


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/", tags=["health"])
def root():
    """Quick sanity check — confirms the API is running."""
    return {"status": "ok", "app": "TestGen AI"}
