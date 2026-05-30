"""Notification center endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import (
    get_file_record_for_user,
    insert_notifications,
    list_notifications_for_user,
    mark_notification_read,
    delete_notification,
    mark_all_notifications_read,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])
logger = logging.getLogger(__name__)


@router.post("/generate/{file_id}")
def generate_notifications_for_file(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Scan dataset, generate smart notifications, store and return them."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    from app.analysis.analyzer import analyze_dataframe
    from app.services.notification_service import generate_notifications

    analysis = analyze_dataframe(df)
    notifications = generate_notifications(df, analysis, wu["user_id"], file_id)

    # Persist notifications
    for n in notifications:
        insert_notifications(n)

    return {
        "generated": len(notifications),
        "notifications": notifications,
    }


@router.get("")
def get_notifications(
    limit: int = 25,
    offset: int = 0,
    wu: dict = Depends(get_workspace_user),
):
    """Return a paginated slice of notifications for the current user."""
    all_notifs = list_notifications_for_user(wu["user_id"])
    unread_count = sum(1 for n in all_notifs if not n.get("read", False))
    safe_limit = min(max(1, limit), 100)
    page = all_notifs[offset: offset + safe_limit]
    return {
        "notifications": page,
        "total": len(all_notifs),
        "unread_count": unread_count,
        "offset": offset,
        "limit": safe_limit,
        "has_more": offset + safe_limit < len(all_notifs),
    }


@router.put("/{notification_id}/read")
def read_notification(
    notification_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Mark a notification as read."""
    success = mark_notification_read(notification_id, wu["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok", "notification_id": notification_id}


@router.put("/read-all")
def read_all_notifications(
    wu: dict = Depends(get_workspace_user),
):
    """Mark all notifications as read for the current user."""
    count = mark_all_notifications_read(wu["user_id"])
    return {"status": "ok", "marked_read": count}


@router.delete("/{notification_id}")
def remove_notification(
    notification_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Delete a notification."""
    success = delete_notification(notification_id, wu["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "deleted", "notification_id": notification_id}
