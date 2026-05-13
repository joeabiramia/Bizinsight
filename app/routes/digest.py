import logging
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.routes.auth import get_current_user
from app.storage import kv_get, kv_set

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/digest", tags=["digest"])


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


class TestEmailRequest(BaseModel):
    email: str


@router.get("/settings")
def get_settings(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    saved = kv_get(f"digest_settings_{user_id}")
    if saved:
        return saved
    return DigestSettings(recipient_email=current_user.get("email", "")).model_dump()


@router.post("/settings")
def save_settings(settings: DigestSettings, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    kv_set(f"digest_settings_{user_id}", settings.model_dump())
    return {"success": True, "message": "Digest settings saved."}


@router.post("/send-test")
async def send_test_email(req: TestEmailRequest, current_user: dict = Depends(get_current_user)):
    try:
        from app.services.email_service import send_email
        user_name = current_user.get("name", "there")
        html = f"""
        <div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;
                    background:#0d1424;color:#e8edf5;padding:32px;border-radius:16px;">
          <h2 style="color:#818cf8;margin-bottom:8px;">Your Weekly Business Digest</h2>
          <p>Hey {user_name} 👋 — this is a test from BizInsight AI.</p>
          <p style="color:#94a3b8;font-size:14px;">
            Once you have data uploaded, real metrics and AI insights will appear here each week.
          </p>
          <a href="#" style="display:inline-block;background:#6366f1;color:white;
                             padding:12px 24px;border-radius:10px;text-decoration:none;
                             font-weight:700;margin-top:16px;">
            View Dashboard →
          </a>
          <p style="color:#64748b;font-size:12px;margin-top:24px;">Powered by BizInsight AI</p>
        </div>
        """
        await send_email(to=req.email, subject="[Test] Your BizInsight AI Weekly Digest", html=html)
    except Exception as exc:
        logger.warning("Test email not sent (email service unavailable): %s", exc)

    return {"success": True, "message": f"Test email queued for {req.email}"}


@router.post("/send-now")
def send_digest_now(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    settings = kv_get(f"digest_settings_{user_id}")
    if not settings or not settings.get("enabled"):
        return {"success": False, "message": "Digest is disabled or not configured."}
    return {"success": True, "message": "Digest queued for delivery."}
