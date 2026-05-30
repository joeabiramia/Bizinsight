import time
import uuid
from collections import defaultdict
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.auth_utils import create_token, hash_password, verify_password
from app.dependencies import get_current_user
from app.storage import (
    get_user_by_email,
    get_user_by_id,
    insert_user,
    update_user,
    update_user_onboarding,
    kv_get,
    kv_set,
    kv_delete,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# ── Simple in-memory rate limiter ─────────────────────────────────────────────
# Tracks (IP, endpoint) → list of attempt timestamps.
# Allows max 10 attempts per 60-second window.

_rate_store: dict = defaultdict(list)
_RATE_LIMIT   = 10   # max attempts
_RATE_WINDOW  = 60   # seconds


def _check_rate_limit(request: Request, key: str) -> None:
    ip = request.client.host if request.client else "unknown"
    store_key = f"{ip}:{key}"
    now = time.monotonic()
    window_start = now - _RATE_WINDOW
    _rate_store[store_key] = [t for t in _rate_store[store_key] if t > window_start]
    if len(_rate_store[store_key]) >= _RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Please wait {_RATE_WINDOW} seconds and try again.",
        )
    _rate_store[store_key].append(now)


# ── Models ────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class OnboardingRequest(BaseModel):
    business_type: str
    company_size: str
    goal: str
    data_types: List[str]
    user_role: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "onboarding_complete": user.get("onboarding_complete", False),
        "onboarding_data": user.get("onboarding_data"),
        "email_verified": user.get("email_verified", False),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/register")
def register(req: RegisterRequest, request: Request):
    _check_rate_limit(request, "register")

    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user_id = str(uuid.uuid4())
    user = {
        "user_id": user_id,
        "email": email,
        "name": req.name.strip() or email.split("@")[0],
        "password_hash": hash_password(req.password),
        "created_at": datetime.utcnow().isoformat(),
        "onboarding_complete": False,
        "onboarding_data": None,
        "email_verified": False,
    }
    insert_user(user)

    # Send verification email (non-blocking; failure doesn't prevent registration)
    try:
        _send_verification_email(user)
    except Exception:
        pass

    token = create_token(user["user_id"], user["email"])
    return {"token": token, "user": _public_user(user)}


@router.post("/login")
def login(req: LoginRequest, request: Request):
    _check_rate_limit(request, "login")

    email = req.email.lower().strip()
    user = get_user_by_email(email)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("deleted_at"):
        raise HTTPException(status_code=401, detail="This account has been deleted.")
    token = create_token(user["user_id"], user["email"])
    return {"token": token, "user": _public_user(user)}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)


@router.post("/refresh")
def refresh_token(current_user: dict = Depends(get_current_user)):
    """Issue a fresh 30-day token. Call when the current token is close to expiry."""
    token = create_token(current_user["user_id"], current_user["email"])
    return {"token": token, "user": _public_user(current_user)}


@router.delete("/account")
def delete_account(current_user: dict = Depends(get_current_user)):
    """Soft-delete the account: marks deleted_at and clears sensitive data."""
    from datetime import datetime
    user_id = current_user["user_id"]
    update_user(user_id, {
        "deleted_at": datetime.utcnow().isoformat(),
        "email": f"deleted_{user_id}@deleted",
        "password_hash": "",
        "name": "Deleted User",
    })
    return {"success": True, "message": "Account deleted."}


@router.post("/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    current_user: dict = Depends(get_current_user),
):
    update_user_onboarding(current_user["user_id"], req.model_dump())
    return {"success": True, "message": "Onboarding complete"}


@router.put("/profile")
def update_profile(
    req: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update display name and/or password."""
    updates: dict = {}

    if req.name is not None:
        name = req.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Name cannot be empty")
        updates["name"] = name

    if req.new_password is not None:
        if not req.current_password:
            raise HTTPException(status_code=400, detail="Current password required to set a new password")
        if not verify_password(req.current_password, current_user.get("password_hash", "")):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
        updates["password_hash"] = hash_password(req.new_password)

    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")

    update_user(current_user["user_id"], updates)
    updated_user = get_user_by_id(current_user["user_id"])
    return _public_user(updated_user or {**current_user, **updates})


# ── Email verification ────────────────────────────────────────────────────────

def _send_verification_email(user: dict) -> None:
    from app.auth_utils import create_token
    from app.services.email_service import send_email, is_configured
    if not is_configured():
        return
    token = create_token(user["user_id"], user["email"])
    verify_url = f"http://localhost:5173/verify-email?token={token}"
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0d1424;
                color:#e8edf5;padding:32px;border-radius:16px;">
      <h2 style="color:#818cf8;margin-bottom:8px;">Verify your email</h2>
      <p>Hey {user.get('name','there')} — thanks for joining BizInsight AI.</p>
      <p>Click the button below to verify your email address.</p>
      <a href="{verify_url}"
         style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;
                border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px;">
        Verify Email →
      </a>
      <p style="color:#64748b;font-size:12px;margin-top:24px;">
        This link expires in 24 hours. If you didn't create this account, ignore this email.
      </p>
    </div>"""
    send_email(to=user["email"], subject="Verify your BizInsight AI email", html_body=html)


@router.post("/resend-verification")
def resend_verification(current_user: dict = Depends(get_current_user)):
    if current_user.get("email_verified"):
        return {"success": True, "message": "Email already verified"}
    try:
        _send_verification_email(current_user)
        return {"success": True, "message": "Verification email sent"}
    except Exception:
        return {"success": False, "message": "Email service unavailable"}


@router.post("/verify-email")
def verify_email(token: str):
    from app.auth_utils import verify_token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired verification link")
    if not get_user_by_id(payload["user_id"]):
        raise HTTPException(status_code=404, detail="User not found")
    update_user(payload["user_id"], {"email_verified": True})
    return {"success": True, "message": "Email verified successfully"}


# ── Password reset ────────────────────────────────────────────────────────────

_RESET_TTL = 3600  # 1 hour


@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, request: Request):
    _check_rate_limit(request, "forgot-password")

    email = req.email.lower().strip()
    user = get_user_by_email(email)
    # Always return 200 to avoid email enumeration
    if not user:
        return {"success": True, "message": "If that email exists you will receive a reset link shortly."}

    reset_token = str(uuid.uuid4())
    token_key = f"pwd_reset_{reset_token}"
    kv_set(token_key, {
        "user_id": user["user_id"],
        "expires_at": time.time() + _RESET_TTL,
    })
    # Track the key so the startup cleanup loop can find and remove expired tokens
    index = kv_get("_pwd_reset_index") or []
    index.append(token_key)
    kv_set("_pwd_reset_index", index[-500:])  # cap at 500 entries

    try:
        from app.services.email_service import send_email, is_configured
        if is_configured():
            reset_url = f"http://localhost:5173/reset-password?token={reset_token}"
            html = f"""
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0d1424;
                        color:#e8edf5;padding:32px;border-radius:16px;">
              <h2 style="color:#818cf8;margin-bottom:8px;">Reset your password</h2>
              <p>Hey {user.get('name','there')} — we received a password reset request for your account.</p>
              <a href="{reset_url}"
                 style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;
                        border-radius:10px;text-decoration:none;font-weight:700;margin-top:16px;">
                Reset Password →
              </a>
              <p style="color:#64748b;font-size:12px;margin-top:24px;">
                This link expires in 1 hour. If you didn't request this, ignore this email.
              </p>
            </div>"""
            send_email(to=email, subject="Reset your BizInsight AI password", html_body=html)
    except Exception:
        pass

    return {"success": True, "message": "If that email exists you will receive a reset link shortly."}


@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request):
    _check_rate_limit(request, "reset-password")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    record = kv_get(f"pwd_reset_{req.token}")
    if not record or record.get("expires_at", 0) < time.time():
        raise HTTPException(status_code=400, detail="Reset link is invalid or has expired")

    if not get_user_by_id(record["user_id"]):
        raise HTTPException(status_code=404, detail="User not found")
    update_user(record["user_id"], {"password_hash": hash_password(req.new_password)})
    kv_delete(f"pwd_reset_{req.token}")

    return {"success": True, "message": "Password reset successfully. You can now log in."}
