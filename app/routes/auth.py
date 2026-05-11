import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth_utils import create_token, hash_password, verify_password
from app.dependencies import get_current_user
from app.storage import (
    get_user_by_email,
    get_user_by_id,
    insert_user,
    update_user_onboarding,
)

router = APIRouter(prefix="/auth", tags=["auth"])


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


def _public_user(user: dict) -> dict:
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user.get("name", ""),
        "onboarding_complete": user.get("onboarding_complete", False),
        "onboarding_data": user.get("onboarding_data"),
    }


@router.post("/register")
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if get_user_by_email(email):
        raise HTTPException(status_code=409, detail="Email already registered")

    user = {
        "user_id": str(uuid.uuid4()),
        "email": email,
        "name": req.name.strip() or email.split("@")[0],
        "password_hash": hash_password(req.password),
        "created_at": datetime.utcnow().isoformat(),
        "onboarding_complete": False,
        "onboarding_data": None,
    }
    insert_user(user)
    token = create_token(user["user_id"], user["email"])
    return {"token": token, "user": _public_user(user)}


@router.post("/login")
def login(req: LoginRequest):
    email = req.email.lower().strip()
    user = get_user_by_email(email)
    if not user or not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["user_id"], user["email"])
    return {"token": token, "user": _public_user(user)}


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    return _public_user(current_user)


@router.post("/onboarding")
def complete_onboarding(
    req: OnboardingRequest,
    current_user: dict = Depends(get_current_user),
):
    update_user_onboarding(current_user["user_id"], req.model_dump())
    return {"success": True, "message": "Onboarding complete"}
