"""Scheduled Email Reports routes.

POST /schedules              → create a schedule
GET  /schedules              → list user's schedules
PUT  /schedules/{id}         → update (pause/resume/edit)
DELETE /schedules/{id}       → delete
POST /schedules/{id}/send-now → send immediately (test)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.services.email_service import is_configured, send_email, build_report_email
from app.services.scheduler_service import register_schedule, unregister_schedule
from app.storage import (
    get_file_record_for_user,
    insert_schedule,
    get_schedule_for_user,
    list_schedules_for_user,
    update_schedule,
    delete_schedule,
)

router = APIRouter(prefix="/schedules", tags=["schedules"])
logger = logging.getLogger(__name__)


class ScheduleCreate(BaseModel):
    file_id: str
    email: str
    recipient_name: str = ""
    frequency: str = "weekly"       # daily | weekly | monthly
    time_of_day: str = "08:00"      # HH:MM UTC
    day_of_week: int = 0            # 0=Mon … 6=Sun (weekly only)
    day_of_month: int = 1           # 1-28 (monthly only)
    dashboard_url: str = ""


class ScheduleUpdate(BaseModel):
    email: str | None = None
    recipient_name: str | None = None
    frequency: str | None = None
    time_of_day: str | None = None
    day_of_week: int | None = None
    day_of_month: int | None = None
    active: bool | None = None
    dashboard_url: str | None = None


@router.post("")
def create_schedule(
    body: ScheduleCreate,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(body.file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    schedule_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    schedule = {
        "schedule_id": schedule_id,
        "user_id": current_user["user_id"],
        "file_id": body.file_id,
        "filename": file_doc.get("filename", ""),
        "email": body.email,
        "recipient_name": body.recipient_name,
        "frequency": body.frequency,
        "time_of_day": body.time_of_day,
        "day_of_week": body.day_of_week,
        "day_of_month": body.day_of_month,
        "dashboard_url": body.dashboard_url or f"http://localhost:5173/analysis/{body.file_id}",
        "active": True,
        "created_at": now,
        "last_sent_at": None,
        "last_status": None,
    }
    insert_schedule(schedule)
    register_schedule(schedule)
    return {**schedule, "smtp_configured": is_configured()}


@router.get("")
def list_schedules(current_user: dict = Depends(get_current_user)):
    schedules = list_schedules_for_user(current_user["user_id"])
    return {"schedules": schedules, "smtp_configured": is_configured()}


@router.put("/{schedule_id}")
def update_schedule_route(
    schedule_id: str,
    body: ScheduleUpdate,
    current_user: dict = Depends(get_current_user),
):
    existing = get_schedule_for_user(schedule_id, current_user["user_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    update_schedule(schedule_id, patch)
    updated = {**existing, **patch}
    register_schedule(updated)
    return updated


@router.delete("/{schedule_id}")
def delete_schedule_route(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
):
    existing = get_schedule_for_user(schedule_id, current_user["user_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    unregister_schedule(schedule_id)
    delete_schedule(schedule_id, current_user["user_id"])
    return {"deleted": True}


@router.post("/{schedule_id}/send-now")
def send_now(
    schedule_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Send the report immediately as a test."""
    schedule = get_schedule_for_user(schedule_id, current_user["user_id"])
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found.")
    if not is_configured():
        raise HTTPException(
            status_code=422,
            detail="SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS environment variables.",
        )
    file_doc = get_file_record_for_user(schedule["file_id"], current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="Dataset not found.")

    from app.dataframe_utils import load_dataframe
    from app.monitoring.alert_engine import generate_alerts
    from app.dataframe_utils import safe_number

    df = load_dataframe(file_doc["path"])
    alerts = generate_alerts(df)

    kpis = []
    for col in df.select_dtypes(include="number").columns[:6]:
        vals = df[col].apply(safe_number).dropna()
        if vals.empty:
            continue
        kpis.append({
            "metric": col,
            "total": f"{vals.sum():,.0f}",
            "trend": "up" if len(vals) >= 2 and vals.iloc[-1] > vals.iloc[-2] else "down",
            "change_pct": float((vals.iloc[-1] - vals.iloc[-2]) / abs(vals.iloc[-2]) * 100)
                          if len(vals) >= 2 and vals.iloc[-2] != 0 else 0.0,
        })

    html = build_report_email(
        recipient_name=schedule.get("recipient_name", ""),
        filename=file_doc.get("filename", ""),
        kpis=kpis,
        insights=[a["title"] + ": " + a["message"] for a in alerts[:3]],
        alerts=[a for a in alerts if a["severity"] in ("high", "medium")][:3],
        dashboard_url=schedule.get("dashboard_url", ""),
        pulse="stable",
    )

    sent = send_email(schedule["email"], f"BizInsight Report — {file_doc.get('filename','')}", html)
    now = datetime.now(timezone.utc).isoformat()
    update_schedule(schedule_id, {"last_sent_at": now, "last_status": "sent" if sent else "failed"})
    return {"sent": sent, "to": schedule["email"]}
