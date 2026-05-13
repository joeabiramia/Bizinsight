"""Audit Log endpoints."""
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.storage import get_audit_logs_for_user

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger(__name__)


@router.get("/logs")
def get_audit_logs(
    limit: int = 100,
    current_user: dict = Depends(get_current_user),
):
    """Retrieve the current user's audit log history."""
    logs = get_audit_logs_for_user(current_user["user_id"], limit=min(limit, 500))
    return {
        "logs": logs,
        "total": len(logs),
        "user_id": current_user["user_id"],
    }
