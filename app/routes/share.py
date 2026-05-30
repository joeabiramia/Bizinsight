"""Shareable Dashboard Links.

POST /share/create/{file_id}  → generate a public share token
GET  /share/links             → list user's share links
DELETE /share/{token}         → revoke a share link
GET  /public/dashboard/{token} → public endpoint (no auth) returns analysis data
"""
from __future__ import annotations

import secrets
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.analysis.analyzer import analyze_dataframe
from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import (
    get_file_record_for_user,
    get_file_record,
    insert_share_token,
    get_share_token,
    list_share_tokens_for_user,
    delete_share_token,
    increment_share_views,
)

router = APIRouter(tags=["share"])
logger = logging.getLogger(__name__)


class ShareCreate(BaseModel):
    label: str = ""


@router.post("/share/create/{file_id}")
def create_share_link(
    file_id: str,
    body: ShareCreate,
    wu: dict = Depends(get_workspace_user),
):
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    token = secrets.token_urlsafe(20)
    now = datetime.now(timezone.utc).isoformat()
    record = {
        "token": token,
        "file_id": file_id,
        "user_id": wu["user_id"],
        "filename": file_doc.get("filename", ""),
        "label": body.label or file_doc.get("filename", "Dashboard"),
        "created_at": now,
        "views": 0,
        "active": True,
    }
    insert_share_token(record)
    return {
        "token": token,
        "share_url": f"/public/dashboard/{token}",
        "label": record["label"],
        "created_at": now,
    }


@router.get("/share/links")
def list_share_links(wu: dict = Depends(get_workspace_user)):
    tokens = list_share_tokens_for_user(wu["user_id"])
    return {"links": tokens}


@router.delete("/share/{token}")
def revoke_share_link(token: str, wu: dict = Depends(get_workspace_user)):
    deleted = delete_share_token(token, wu["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Share link not found.")
    return {"revoked": True}


@router.get("/public/dashboard/{token}")
def public_dashboard(token: str):
    """Public — no authentication required."""
    record = get_share_token(token)
    if not record or not record.get("active"):
        raise HTTPException(status_code=404, detail="This link is invalid or has been revoked.")

    file_doc = get_file_record(record["file_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="The dataset for this link is no longer available.")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load dataset: {exc}")

    increment_share_views(token)

    return {
        "token": token,
        "label": record.get("label", ""),
        "filename": file_doc.get("filename", ""),
        "shared_by": "",
        "views": record.get("views", 0) + 1,
        "file_id": record["file_id"],
        "analysis": analyze_dataframe(df),
    }
