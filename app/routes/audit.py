"""Audit Log endpoints."""
import logging

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user
from app.storage import get_audit_logs_for_user

router = APIRouter(prefix="/audit", tags=["audit"])
logger = logging.getLogger(__name__)

_PAGE_SIZE = 25


@router.get("/logs")
def get_audit_logs(
    limit: int = _PAGE_SIZE,
    offset: int = 0,
    current_user: dict = Depends(get_current_user),
):
    """Return a paginated slice of the current user's audit log."""
    safe_limit = min(max(1, limit), 200)
    all_logs = get_audit_logs_for_user(current_user["user_id"], limit=1000)
    page = all_logs[offset: offset + safe_limit]
    return {
        "logs": page,
        "total": len(all_logs),
        "offset": offset,
        "limit": safe_limit,
        "has_more": offset + safe_limit < len(all_logs),
    }
