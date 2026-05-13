"""Alert Channel Configuration — Slack and WhatsApp.

POST /alert-channels           → add a channel
GET  /alert-channels           → list user's channels
PUT  /alert-channels/{id}      → update (toggle active, change config)
DELETE /alert-channels/{id}    → remove
POST /alert-channels/test/{id} → send a test alert
POST /alert-channels/dispatch/{file_id} → manually dispatch alerts for a dataset
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.monitoring.alert_engine import generate_alerts
from app.services.notification_channels import dispatch_alerts, send_slack, send_whatsapp
from app.storage import (
    delete_alert_channel,
    get_alert_channel,
    get_file_record_for_user,
    insert_alert_channel,
    list_alert_channels_for_user,
    update_alert_channel,
)

router = APIRouter(prefix="/alert-channels", tags=["alert-channels"])


class ChannelCreate(BaseModel):
    channel_type: str          # "slack" | "whatsapp"
    label: str = ""
    webhook_url: str = ""      # Slack
    phone_number: str = ""     # WhatsApp (+1234567890)
    active: bool = True


class ChannelUpdate(BaseModel):
    label: str | None = None
    webhook_url: str | None = None
    phone_number: str | None = None
    active: bool | None = None


@router.post("")
def add_channel(body: ChannelCreate, current_user: dict = Depends(get_current_user)):
    if body.channel_type == "slack" and not body.webhook_url:
        raise HTTPException(status_code=422, detail="webhook_url is required for Slack.")
    if body.channel_type == "whatsapp" and not body.phone_number:
        raise HTTPException(status_code=422, detail="phone_number is required for WhatsApp.")

    channel_id = str(uuid.uuid4())
    record = {
        "channel_id": channel_id,
        "user_id": current_user["user_id"],
        "channel_type": body.channel_type,
        "label": body.label or body.channel_type.capitalize(),
        "webhook_url": body.webhook_url,
        "phone_number": body.phone_number,
        "active": body.active,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    insert_alert_channel(record)
    return record


@router.get("")
def list_channels(current_user: dict = Depends(get_current_user)):
    return {"channels": list_alert_channels_for_user(current_user["user_id"])}


@router.put("/{channel_id}")
def update_channel(
    channel_id: str,
    body: ChannelUpdate,
    current_user: dict = Depends(get_current_user),
):
    ch = get_alert_channel(channel_id, current_user["user_id"])
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found.")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    update_alert_channel(channel_id, current_user["user_id"], patch)
    return {**ch, **patch}


@router.delete("/{channel_id}")
def remove_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    if not delete_alert_channel(channel_id, current_user["user_id"]):
        raise HTTPException(status_code=404, detail="Channel not found.")
    return {"deleted": True}


@router.post("/test/{channel_id}")
def test_channel(channel_id: str, current_user: dict = Depends(get_current_user)):
    ch = get_alert_channel(channel_id, current_user["user_id"])
    if not ch:
        raise HTTPException(status_code=404, detail="Channel not found.")
    test_alerts = [{
        "type": "opportunity", "title": "Test Alert from BizInsight",
        "message": "This is a test notification to verify your channel is configured correctly.",
        "severity": "low", "recommended_action": "No action needed — this is a test.",
    }]
    results = dispatch_alerts([ch], test_alerts, "Test Dataset")
    return {"results": results}


@router.post("/dispatch/{file_id}")
def dispatch_for_file(file_id: str, current_user: dict = Depends(get_current_user)):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")
    df = load_dataframe(file_doc["path"])
    alerts = generate_alerts(df)
    if not alerts:
        return {"message": "No alerts to send.", "results": []}
    channels = list_alert_channels_for_user(current_user["user_id"])
    results = dispatch_alerts(channels, alerts, file_doc.get("filename", ""))
    return {"alert_count": len(alerts), "channels_notified": len(results), "results": results}
