"""
Database models for TestGen AI.
Defines the three core tables: User, Snippet, GeneratedTest.
"""
import uuid
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.dialects.sqlite import TEXT
from datetime import datetime, timezone
import enum

Base = declarative_base()


class GenerationStatus(str, enum.Enum):
    """Possible outcomes of a test generation attempt."""
    success = "success"
    error = "error"


def generate_uuid():
    """Generate a random UUID4 string, used as primary key for all tables."""
    return str(uuid.uuid4())


class User(Base):
    """
    Stores registered users.
    Email is used as the unique identifier (no username field).
    Passwords are never stored in plain text — only the bcrypt hash.
    """
    __tablename__ = "users"

    id = Column(TEXT, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # One user -> many snippets
    snippets = relationship("Snippet", back_populates="user", cascade="all, delete-orphan")


class Snippet(Base):
    """
    Stores a piece of source code submitted by a user.
    Each snippet is linked to one user and can have multiple generation attempts.
    """
    __tablename__ = "snippets"

    id = Column(TEXT, primary_key=True, default=generate_uuid)
    user_id = Column(TEXT, ForeignKey("users.id"), nullable=False)
    language = Column(String, nullable=False)        # e.g. "python", "javascript"
    source_code = Column(Text, nullable=False)
    submitted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="snippets")
    generated_tests = relationship("GeneratedTest", back_populates="snippet", cascade="all, delete-orphan")


class GeneratedTest(Base):
    """
    Stores the test code produced by the LLM for a given snippet.
    Status tracks whether the generation succeeded or failed,
    so failed attempts are preserved for debugging without polluting the UI.
    """
    __tablename__ = "generated_tests"

    id = Column(TEXT, primary_key=True, default=generate_uuid)
    snippet_id = Column(TEXT, ForeignKey("snippets.id"), nullable=False)
    test_code = Column(Text, nullable=True)          # null if generation failed
    llm_provider = Column(String, nullable=False)    # "mistral" | "groq" | "openai"
    status = Column(Enum(GenerationStatus), nullable=False, default=GenerationStatus.success)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationship
    snippet = relationship("Snippet", back_populates="generated_tests")