"""Fraud and Suspicious Activity Detection endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/fraud", tags=["fraud"])
logger = logging.getLogger(__name__)


@router.get("/{file_id}")
def detect_fraud(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Run fraud and suspicious activity detection on a dataset."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.services.fraud_service import detect_fraud_patterns
        result = detect_fraud_patterns(df)
        log_action(
            wu["user_id"],
            "fraud_scan",
            "file",
            file_id,
            {"alerts_found": result.get("total_alerts", 0), "risk_level": result.get("risk_level")},
        )
        return {"file_id": file_id, **result}
    except Exception as exc:
        logger.exception("Fraud detection failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Fraud detection failed: {exc}")
