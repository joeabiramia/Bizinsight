"""Anomaly detection endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(prefix="/anomalies", tags=["anomalies"])
logger = logging.getLogger(__name__)


@router.get("/{file_id}")
def get_anomalies(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Detect statistical anomalies (Z-score + IQR) in dataset columns."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.services.anomaly_service import detect_anomalies
        result = detect_anomalies(df)
        return {"file_id": file_id, **result}
    except Exception as exc:
        logger.exception("Anomaly detection failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {exc}")
