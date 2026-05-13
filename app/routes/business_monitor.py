"""AI Business Monitor API.

GET /business-monitor/{file_id}  → AI-generated business pulse and recommendations
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.ai.business_monitor import run_business_monitor
from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(tags=["business-monitor"])


@router.get("/business-monitor/{file_id}")
async def get_business_monitor(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Run AI business monitor and return pulse + recommendations."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        df = load_dataframe(file_doc["path"])
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load dataset: {exc}")

    result = await run_business_monitor(df)
    result["file_id"] = file_id
    return result
