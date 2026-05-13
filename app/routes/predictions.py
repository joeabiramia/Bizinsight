"""Predictive analytics endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(prefix="/predictions", tags=["predictions"])
logger = logging.getLogger(__name__)


@router.get("/{file_id}")
def get_predictions(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Generate ML-based forecasts for numeric columns in the dataset."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.analysis.analyzer import analyze_dataframe
        from app.services.prediction_service import generate_predictions
        analysis = analyze_dataframe(df)
        result = generate_predictions(df, analysis)
        return result
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("Prediction failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}")
