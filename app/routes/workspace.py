import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.routes.auth import get_current_user
from app.storage import kv_get, kv_set

router = APIRouter(prefix="/workspace", tags=["workspace"])


class InviteRequest(BaseModel):
    email: str
    role: str = "analyst"


class MemberPatch(BaseModel):
    role: Optional[str] = None


def _members_key(user_id: str) -> str:
    return f"workspace_members_{user_id}"


@router.get("/members")
def get_members(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    members: list = kv_get(_members_key(user_id)) or []
    owner = {
        "id": user_id,
        "email": current_user.get("email", ""),
        "name": current_user.get("name", "Owner"),
        "role": "owner",
        "joined_at": datetime.utcnow().isoformat(),
        "last_active": "just now",
        "avatar_letter": (current_user.get("name") or current_user.get("email", "O"))[0].upper(),
    }
    return {"members": [owner] + members}


@router.post("/invite")
def invite_member(req: InviteRequest, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    members: list = kv_get(_members_key(user_id)) or []

    if any(m["email"] == req.email for m in members):
        raise HTTPException(status_code=400, detail="Member already invited.")

    new_member = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.email.split("@")[0],
        "role": req.role,
        "joined_at": datetime.utcnow().isoformat(),
        "last_active": "Invited",
        "avatar_letter": req.email[0].upper(),
    }
    members.append(new_member)
    kv_set(_members_key(user_id), members)
    return {"success": True, "member": new_member}


@router.patch("/members/{member_id}")
def update_member(member_id: str, patch: MemberPatch, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    members: list = kv_get(_members_key(user_id)) or []
    for m in members:
        if m["id"] == member_id:
            if patch.role:
                m["role"] = patch.role
            kv_set(_members_key(user_id), members)
            return {"success": True, "member": m}
    raise HTTPException(status_code=404, detail="Member not found.")


@router.delete("/members/{member_id}")
def remove_member(member_id: str, current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    members: list = kv_get(_members_key(user_id)) or []
    new_members = [m for m in members if m["id"] != member_id]
    if len(new_members) == len(members):
        raise HTTPException(status_code=404, detail="Member not found.")
    kv_set(_members_key(user_id), new_members)
    return {"success": True}


@router.get("/invite-link")
def get_invite_link(current_user: dict = Depends(get_current_user)):
    user_id = current_user.get("user_id", "")
    token = user_id[:8] if len(user_id) >= 8 else user_id
    return {"link": f"/join/{token}"}


@router.post("/branding")
def save_branding(settings: dict, current_user: dict = Depends(get_current_user)):
    kv_set(f"branding_{current_user['user_id']}", settings)
    return {"success": True}


@router.get("/branding")
def get_branding(current_user: dict = Depends(get_current_user)):
    return kv_get(f"branding_{current_user['user_id']}") or {}
