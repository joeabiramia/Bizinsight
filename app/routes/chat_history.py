"""AI Chat History — persist and retrieve conversation messages per dataset."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.dependencies import get_current_user
from app.storage import (
    get_file_record_for_user,
    insert_chat_message,
    list_chat_history,
    clear_chat_history,
)

router = APIRouter(tags=["chat-history"])


@router.get("/ai-chat/history/{file_id}")
def get_chat_history(
    file_id: str,
    limit: int = 50,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")
    messages = list_chat_history(current_user["user_id"], file_id, limit=limit)
    return {"file_id": file_id, "messages": messages, "total": len(messages)}


@router.delete("/ai-chat/history/{file_id}")
def clear_history(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")
    clear_chat_history(current_user["user_id"], file_id)
    return {"cleared": True}
