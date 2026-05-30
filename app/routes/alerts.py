"""Real-Time Alert API.

GET /alerts/{file_id}  → generate and return business alerts for a dataset
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.monitoring.alert_engine import generate_alerts
from app.storage import get_file_record_for_user

router = APIRouter(tags=["alerts"])


@router.get("/alerts/{file_id}")
def get_alerts(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Analyze dataset and return real-time business alerts."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        df = load_dataframe(file_doc["path"])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load dataset: {exc}")

    alerts = generate_alerts(df)

    risk_count = sum(1 for a in alerts if a["type"] == "risk")
    opportunity_count = sum(1 for a in alerts if a["type"] == "opportunity")
    warning_count = sum(1 for a in alerts if a["type"] == "warning")
    high_count = sum(1 for a in alerts if a["severity"] == "high")

    return {
        "file_id": file_id,
        "total_alerts": len(alerts),
        "summary": {
            "risk": risk_count,
            "opportunity": opportunity_count,
            "warning": warning_count,
            "high_severity": high_count,
        },
        "alerts": alerts,
    }
