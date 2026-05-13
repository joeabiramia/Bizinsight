"""Business health score endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(prefix="/health-score", tags=["health"])
logger = logging.getLogger(__name__)


@router.get("/{file_id}")
def get_health_score(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Compute AI business health scores (overall, stability, growth, risk)."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.analysis.analyzer import analyze_dataframe
        from app.services.health_score_service import calculate_health_scores
        analysis = analyze_dataframe(df)
        scores = calculate_health_scores(df, analysis)
        return {"file_id": file_id, "scores": scores}
    except Exception as exc:
        logger.exception("Health score failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Health score calculation failed: {exc}")
