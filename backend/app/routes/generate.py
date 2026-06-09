"""
Generation route for TestGen AI.
Receives source code, runs it through the LLM service, stores the result.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.models import Snippet, GeneratedTest, GenerationStatus
from app.main import get_db
from app.routes.auth import get_current_user, User
from app.services.llm import generate_tests

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class GenerateRequest(BaseModel):
    source_code: str
    language: str          # "python" | "javascript" | "java" | etc.
    llm: Optional[str] = "mistral"   # preferred provider, fallback handled by service


class GenerateResponse(BaseModel):
    test_code: str
    snippet_id: int
    llm_provider: str
    status: str


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@router.post("/generate", response_model=GenerateResponse)
async def generate(
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Main generation endpoint.
    1. Saves the submitted snippet to DB.
    2. Calls the LLM service (with automatic fallback).
    3. Saves the generated tests to DB.
    4. Returns the test code and metadata.
    """

    # Save the submitted snippet
    snippet = Snippet(
        user_id=current_user.id,
        language=payload.language.lower(),
        source_code=payload.source_code
    )
    db.add(snippet)
    db.commit()
    db.refresh(snippet)

    # Call LLM service — handles prompt chaining + fallback internally
    try:
        result = await generate_tests(
            source_code=payload.source_code,
            language=payload.language.lower(),
            preferred_provider=payload.llm
        )
    except Exception as e:
        # Save the failed attempt so we can debug later
        failed = GeneratedTest(
            snippet_id=snippet.id,
            test_code=None,
            llm_provider=payload.llm or "mistral",
            status=GenerationStatus.error
        )
        db.add(failed)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"All LLM providers failed: {str(e)}"
        )

    # Save successful generation
    generated = GeneratedTest(
        snippet_id=snippet.id,
        test_code=result["test_code"],
        llm_provider=result["provider"],
        status=GenerationStatus.success
    )
    db.add(generated)
    db.commit()
    db.refresh(generated)

    return GenerateResponse(
        test_code=result["test_code"],
        snippet_id=snippet.id,
        llm_provider=result["provider"],
        status="success"
    )