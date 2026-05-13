"""Notification center endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
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
    current_user: dict = Depends(get_current_user),
):
    """Scan dataset, generate smart notifications, store and return them."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    from app.analysis.analyzer import analyze_dataframe
    from app.services.notification_service import generate_notifications

    analysis = analyze_dataframe(df)
    notifications = generate_notifications(df, analysis, current_user["user_id"], file_id)

    # Persist notifications
    for n in notifications:
        insert_notifications(n)

    return {
        "generated": len(notifications),
        "notifications": notifications,
    }


@router.get("")
def get_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Return all notifications for the current user."""
    notifications = list_notifications_for_user(current_user["user_id"])
    unread_count = sum(1 for n in notifications if not n.get("read", False))
    return {
        "notifications": notifications,
        "total": len(notifications),
        "unread_count": unread_count,
    }


@router.put("/{notification_id}/read")
def read_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Mark a notification as read."""
    success = mark_notification_read(notification_id, current_user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "ok", "notification_id": notification_id}


@router.put("/read-all")
def read_all_notifications(
    current_user: dict = Depends(get_current_user),
):
    """Mark all notifications as read for the current user."""
    count = mark_all_notifications_read(current_user["user_id"])
    return {"status": "ok", "marked_read": count}


@router.delete("/{notification_id}")
def remove_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a notification."""
    success = delete_notification(notification_id, current_user["user_id"])
    if not success:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"status": "deleted", "notification_id": notification_id}
