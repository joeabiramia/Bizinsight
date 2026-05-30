import logging
import threading
import time as _time
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.storage import kv_get, kv_set

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/digest", tags=["digest"])

_JOBS_KEY = "digest_scheduled_jobs"


# ── Models ─────────────────────────────────────────────────────────────────────

class DigestSettings(BaseModel):
    enabled: bool = True
    frequency: str = "weekly"
    send_day: str = "Monday"
    send_time: str = "09:00"
    include_kpis: bool = True
    include_insights: bool = True
    include_alerts: bool = True
    include_forecast: bool = False
    recipient_email: Optional[str] = None


class SendNowRequest(BaseModel):
    recipient_email: str
    subject: str
    custom_message: Optional[str] = None


class ScheduleDigestRequest(BaseModel):
    recipient_email: str
    subject: str
    custom_message: Optional[str] = None
    scheduled_at: str  # ISO 8601 UTC, e.g. "2026-06-01T19:30:00"


# ── Email builder ──────────────────────────────────────────────────────────────

def _build_digest_html(user_name: str, settings: dict, custom_message: Optional[str]) -> str:
    custom_section = ""
    if custom_message and custom_message.strip():
        custom_section = f"""
        <div style="background:rgba(99,102,241,0.08);border-left:3px solid #6366f1;
                    border-radius:8px;padding:14px 18px;margin-bottom:20px;">
          <p style="margin:0;color:#c7d2fe;font-size:14px;line-height:1.6;">{custom_message}</p>
        </div>"""

    kpi_section = ""
    if settings.get("include_kpis", True):
        kpi_section = """
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:#f1f5f9;">📊 Key Metrics</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            Your KPIs — revenue, top products, and key trends — will appear here once data is uploaded.
          </p>
        </div>"""

    insights_section = ""
    if settings.get("include_insights", True):
        insights_section = """
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:#f1f5f9;">💡 AI Insights</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            AI-generated opportunities and risks will be summarised here once data is available.
          </p>
        </div>"""

    alerts_section = ""
    if settings.get("include_alerts", True):
        alerts_section = """
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:#f1f5f9;">🔔 Active Alerts</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            Anomalies and flagged issues will appear here when detected in your data.
          </p>
        </div>"""

    forecast_section = ""
    if settings.get("include_forecast", False):
        forecast_section = """
        <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                    padding:18px;margin-bottom:16px;">
          <p style="margin:0 0 10px;font-weight:700;font-size:14px;color:#f1f5f9;">🔮 Forecast</p>
          <p style="margin:0;color:#94a3b8;font-size:13px;">
            Next-period revenue predictions will appear here once enough historical data is loaded.
          </p>
        </div>"""

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background:#0a0a14;margin:0;padding:24px;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#1e1e2e,#16213e);border:1px solid #2d2d3d;
                border-radius:16px;padding:28px;margin-bottom:16px;text-align:center;">
      <div style="display:inline-block;background:#6366f1;color:#fff;font-size:11px;font-weight:800;
                  padding:3px 12px;border-radius:20px;letter-spacing:0.1em;margin-bottom:16px;">
        BIZINSIGHT AI
      </div>
      <h1 style="margin:0 0 6px;color:#f1f5f9;font-size:22px;">Weekly Business Digest</h1>
      <p style="margin:0;color:#64748b;font-size:13px;">Delivered by BizInsight AI</p>
    </div>

    <div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;
                padding:20px;margin-bottom:16px;">
      <p style="margin:0 0 4px;font-weight:700;color:#f1f5f9;">Hey {user_name},</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">
        Here is your weekly business performance summary from BizInsight AI.
      </p>
    </div>

    {custom_section}
    {kpi_section}
    {insights_section}
    {alerts_section}
    {forecast_section}

    <div style="text-align:center;padding:20px;">
      <a href="http://localhost:5173/dashboard"
         style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;
                padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
        Open Live Dashboard →
      </a>
      <p style="margin:16px 0 0;color:#475569;font-size:11px;">
        Sent from BizInsight AI · Manage your digest preferences in the app.
      </p>
    </div>
  </div>
</body>
</html>"""


def _send_digest(
    to: str,
    subject: str,
    user_name: str,
    settings: dict,
    custom_message: Optional[str],
) -> bool:
    try:
        from app.services.email_service import is_configured, send_email
        if not is_configured():
            logger.warning("SMTP not configured — digest not sent to %s", to)
            return False
        html = _build_digest_html(user_name, settings, custom_message)
        return send_email(to=to, subject=subject, html_body=html)
    except Exception as exc:
        logger.error("Digest email error: %s", exc)
        return False


# ── Background scheduler ───────────────────────────────────────────────────────

def _process_scheduled_jobs() -> None:
    """Send any scheduled jobs whose delivery time has arrived."""
    try:
        jobs: List[dict] = kv_get(_JOBS_KEY) or []
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
        changed = False

        for job in jobs:
            if job.get("status") != "scheduled":
                continue
            if job.get("scheduled_at", "9999") > now_iso:
                continue

            job["status"] = "sending"
            changed = True
            kv_set(_JOBS_KEY, jobs)

            user_settings = kv_get(f"digest_settings_{job['user_id']}") or {}
            sent = _send_digest(
                to=job["recipient_email"],
                subject=job["subject"],
                user_name=job.get("user_name", "there"),
                settings=user_settings,
                custom_message=job.get("custom_message"),
            )

            job["status"] = "sent" if sent else "failed"
            job["sent_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(
                "Scheduled digest %s → %s: %s",
                job["job_id"], job["recipient_email"], job["status"],
            )

            # Fire an in-app notification so the user sees delivery status
            try:
                from app.storage import insert_notifications
                import uuid as _uuid
                insert_notifications({
                    "notification_id": str(_uuid.uuid4()),
                    "user_id": job["user_id"],
                    "type": "digest",
                    "title": "Weekly Digest Delivered" if sent else "Weekly Digest Failed",
                    "message": (
                        f"Your digest was sent to {job['recipient_email']}."
                        if sent else
                        f"Failed to deliver digest to {job['recipient_email']}. Check your SMTP settings."
                    ),
                    "read": False,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
            except Exception:
                pass

        if changed:
            kv_set(_JOBS_KEY, jobs)
    except Exception as exc:
        logger.error("Digest scheduler error: %s", exc)


def _scheduler_loop() -> None:
    while True:
        _time.sleep(60)
        _process_scheduled_jobs()


_scheduler_started = False


def start_scheduler() -> None:
    global _scheduler_started
    if _scheduler_started:
        return
    _scheduler_started = True
    t = threading.Thread(target=_scheduler_loop, daemon=True, name="digest-scheduler")
    t.start()
    logger.info("Digest scheduler started")


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/settings")
def get_settings(current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    saved = kv_get(f"digest_settings_{user_id}")
    if saved:
        return saved
    return DigestSettings(recipient_email=current_user.get("email", "")).model_dump()


@router.post("/settings")
def save_settings(settings: DigestSettings, current_user: dict = Depends(get_current_user)):
    user_id = current_user["user_id"]
    kv_set(f"digest_settings_{user_id}", settings.model_dump())
    return {"success": True, "message": "Digest settings saved."}


@router.post("/send-now")
def send_now(req: SendNowRequest, current_user: dict = Depends(get_current_user)):
    """Send the weekly digest immediately."""
    user_id = current_user["user_id"]
    user_name = current_user.get("name", "there")
    settings = kv_get(f"digest_settings_{user_id}") or {}

    sent = _send_digest(
        to=req.recipient_email,
        subject=req.subject,
        user_name=user_name,
        settings=settings,
        custom_message=req.custom_message,
    )

    if sent:
        logger.info("Digest sent immediately to %s by user %s", req.recipient_email, user_id)
        return {"success": True, "message": f"Digest delivered to {req.recipient_email}."}

    try:
        from app.services.email_service import is_configured
        if not is_configured():
            return {
                "success": False,
                "message": "Email service is not configured. Please set SMTP credentials in your environment.",
            }
    except Exception:
        pass
    return {"success": False, "message": "Failed to send digest. Check your SMTP configuration."}


@router.post("/schedule")
def schedule_digest(req: ScheduleDigestRequest, current_user: dict = Depends(get_current_user)):
    """Schedule a digest email for future delivery."""
    user_id = current_user["user_id"]
    user_name = current_user.get("name", "there")

    try:
        raw = req.scheduled_at.replace("Z", "+00:00")
        scheduled_dt = datetime.fromisoformat(raw)
        if scheduled_dt.tzinfo is None:
            scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
        if scheduled_dt <= datetime.now(timezone.utc):
            raise HTTPException(status_code=400, detail="Scheduled time must be in the future.")
        scheduled_iso = scheduled_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid scheduled_at — use ISO 8601 format.")

    job = {
        "job_id": str(uuid.uuid4()),
        "user_id": user_id,
        "user_name": user_name,
        "recipient_email": req.recipient_email,
        "subject": req.subject,
        "custom_message": req.custom_message,
        "scheduled_at": scheduled_iso,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "sent_at": None,
    }

    jobs: List[dict] = kv_get(_JOBS_KEY) or []
    jobs.append(job)
    kv_set(_JOBS_KEY, jobs)

    logger.info("Digest scheduled for %s at %s by user %s", req.recipient_email, scheduled_iso, user_id)
    return {"success": True, "message": f"Digest scheduled for {req.scheduled_at}.", "job": job}


@router.get("/jobs")
def list_jobs(current_user: dict = Depends(get_current_user)):
    """List digest delivery jobs for the current user (most recent first)."""
    user_id = current_user["user_id"]
    jobs: List[dict] = kv_get(_JOBS_KEY) or []
    user_jobs = sorted(
        [j for j in jobs if j.get("user_id") == user_id],
        key=lambda j: j.get("created_at", ""),
        reverse=True,
    )
    return user_jobs[:20]


@router.delete("/jobs/{job_id}")
def cancel_job(job_id: str, current_user: dict = Depends(get_current_user)):
    """Cancel a scheduled digest job."""
    user_id = current_user["user_id"]
    jobs: List[dict] = kv_get(_JOBS_KEY) or []

    for job in jobs:
        if job.get("job_id") == job_id and job.get("user_id") == user_id:
            if job.get("status") != "scheduled":
                raise HTTPException(status_code=400, detail="Only scheduled jobs can be cancelled.")
            job["status"] = "cancelled"
            kv_set(_JOBS_KEY, jobs)
            return {"success": True, "message": "Scheduled digest cancelled."}

    raise HTTPException(status_code=404, detail="Job not found.")
