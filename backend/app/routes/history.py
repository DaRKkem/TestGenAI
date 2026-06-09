"""
History routes for TestGen AI.
Lets authenticated users list, view, download and delete their past generations.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import tempfile
import os

from app.models import Snippet, GeneratedTest, GenerationStatus
from app.main import get_db
from app.routes.auth import get_current_user, User

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------
class HistoryItemResponse(BaseModel):
    id: int                  # GeneratedTest id
    snippet_id: int
    language: str
    llm_provider: str
    status: str
    generated_at: datetime

    class Config:
        from_attributes = True


class HistoryDetailResponse(BaseModel):
    id: int
    snippet_id: int
    language: str
    source_code: str
    test_code: Optional[str]
    llm_provider: str
    status: str
    generated_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@router.get("", response_model=List[HistoryItemResponse])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return all past generations for the current user.
    Ordered by most recent first.
    """
    results = (
        db.query(GeneratedTest, Snippet)
        .join(Snippet, GeneratedTest.snippet_id == Snippet.id)
        .filter(Snippet.user_id == current_user.id)
        .order_by(GeneratedTest.generated_at.desc())
        .all()
    )

    items = []
    for generated, snippet in results:
        items.append(HistoryItemResponse(
            id=generated.id,
            snippet_id=snippet.id,
            language=snippet.language,
            llm_provider=generated.llm_provider,
            status=generated.status.value,
            generated_at=generated.generated_at
        ))
    return items


@router.get("/{id}", response_model=HistoryDetailResponse)
def get_history_detail(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Return full detail of a single generation (source code + test code).
    Returns 404 if not found, 403 if it belongs to another user.
    """
    generated = db.query(GeneratedTest).filter(GeneratedTest.id == id).first()
    if not generated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    snippet = db.query(Snippet).filter(Snippet.id == generated.snippet_id).first()
    if snippet.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return HistoryDetailResponse(
        id=generated.id,
        snippet_id=snippet.id,
        language=snippet.language,
        source_code=snippet.source_code,
        test_code=generated.test_code,
        llm_provider=generated.llm_provider,
        status=generated.status.value,
        generated_at=generated.generated_at
    )


@router.get("/download/{id}")
def download_test(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download the generated test file as .py or .js depending on the language.
    """
    generated = db.query(GeneratedTest).filter(GeneratedTest.id == id).first()
    if not generated or generated.status != GenerationStatus.success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No test file available")

    snippet = db.query(Snippet).filter(Snippet.id == generated.snippet_id).first()
    if snippet.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Determine file extension from language
    ext = "js" if snippet.language == "javascript" else "py"
    filename = f"test_snippet_{snippet.id}.{ext}"

    # Write to a temp file and serve it
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=f".{ext}", mode="w")
    tmp.write(generated.test_code)
    tmp.close()

    return FileResponse(
        path=tmp.name,
        filename=filename,
        media_type="application/octet-stream"
    )


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_history_entry(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a generation entry and its associated snippet.
    Returns 404 if not found, 403 if it belongs to another user.
    """
    generated = db.query(GeneratedTest).filter(GeneratedTest.id == id).first()
    if not generated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    snippet = db.query(Snippet).filter(Snippet.id == generated.snippet_id).first()
    if snippet.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    db.delete(generated)
    db.delete(snippet)
    db.commit()