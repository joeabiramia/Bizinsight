"""AI Business Strategy Generator endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/strategy", tags=["strategy"])
logger = logging.getLogger(__name__)


class StrategyRequest(BaseModel):
    question: str


@router.post("/{file_id}")
def generate_strategy(
    file_id: str,
    body: StrategyRequest,
    wu: dict = Depends(get_workspace_user),
):
    """Generate an AI-grounded business strategy plan from the dataset."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    if not body.question.strip():
        raise HTTPException(status_code=422, detail="Question cannot be empty")

    try:
        from app.services.strategy_service import generate_strategy as _gen
        result = _gen(df, body.question)
        log_action(
            wu["user_id"],
            "strategy_generated",
            "file",
            file_id,
            {"question": body.question[:100]},
        )
        return {"file_id": file_id, **result}
    except Exception as exc:
        logger.exception("Strategy generation failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Strategy generation failed: {exc}")


@router.get("/examples")
def get_strategy_examples():
    """Return example strategy questions to inspire users."""
    return {
        "examples": [
            "How can we increase profit by 20% this year?",
            "How can we improve sales performance?",
            "How can we reduce business risk?",
            "How can we improve operational efficiency?",
            "What should we do to grow revenue in underperforming segments?",
            "How can we retain more customers?",
            "What are the best opportunities to expand?",
        ]
    }
