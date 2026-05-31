import uuid
import time
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.storage import kv_get, kv_set, kv_delete, get_user_by_email, get_user_by_id

router = APIRouter(prefix="/workspace", tags=["workspace"])
logger = logging.getLogger(__name__)

_INVITE_TTL = 48 * 3600   # 48 hours
_LINK_TTL   = 7  * 86400  # 7 days

# ── Models ────────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str
    role: str = "analyst"


class MemberPatch(BaseModel):
    role: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _members_key(owner_id: str) -> str:
    return f"workspace_members_{owner_id}"


def _valid_role(role: str) -> bool:
    return role in ("admin", "analyst", "viewer")


def _send_invite_email(invitee_email: str, owner_name: str, role: str, token: str) -> None:
    from app.services.email_service import send_email, is_configured
    if not is_configured():
        logger.warning("SMTP not configured — invite email not sent to %s", invitee_email)
        return
    join_url = f"http://localhost:5173/join?token={token}"
    role_label = role.capitalize()
    html = f"""
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#0d1424;
                color:#e8edf5;padding:32px;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:#6366f1;color:#fff;font-size:11px;
                    font-weight:800;padding:3px 12px;border-radius:20px;letter-spacing:0.1em;">
          BIZINSIGHT AI
        </div>
      </div>
      <h2 style="color:#818cf8;margin-bottom:8px;">You've been invited!</h2>
      <p style="color:#94a3b8;line-height:1.6;">
        <strong style="color:#e8edf5;">{owner_name}</strong> has invited you to join their
        BizInsight AI workspace as a <strong style="color:#e8edf5;">{role_label}</strong>.
      </p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;">
        As an <strong>{role_label}</strong> you can:
        {"upload datasets, run analysis, and use the AI Copilot" if role == "analyst" else
         "manage datasets, invite members, and use all analytics features" if role == "admin" else
         "view dashboards and analysis results"}
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="{join_url}"
           style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                  color:white;padding:13px 32px;border-radius:10px;text-decoration:none;
                  font-weight:700;font-size:14px;">
          Accept Invitation →
        </a>
      </div>
      <p style="color:#64748b;font-size:12px;">
        This invitation expires in 48 hours. If you don't have a BizInsight AI account,
        you'll be prompted to create one after clicking the link above.
      </p>
    </div>"""
    send_email(to=invitee_email, subject=f"{owner_name} invited you to BizInsight AI", html_body=html)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/members")
def get_members(current_user: dict = Depends(get_current_user)):
    owner_id = current_user["user_id"]
    members: list = kv_get(_members_key(owner_id)) or []
    owner = {
        "id": owner_id,
        "email": current_user.get("email", ""),
        "name": current_user.get("name", "Owner"),
        "role": "owner",
        "status": "accepted",
        "joined_at": current_user.get("created_at", datetime.utcnow().isoformat()),
        "last_active": "Owner",
        "avatar_letter": (current_user.get("name") or current_user.get("email", "O"))[0].upper(),
    }
    return {"members": [owner] + members}


@router.get("/my-workspace")
def get_my_workspace(current_user: dict = Depends(get_current_user)):
    """Return which workspace this user belongs to (if any)."""
    from app.services.workspace_service import get_user_workspace_owner, get_user_role
    owner_id = get_user_workspace_owner(current_user["user_id"])
    if not owner_id:
        return {"workspace": None, "role": "owner"}
    owner = get_user_by_id(owner_id)
    return {
        "workspace": {
            "owner_id": owner_id,
            "owner_name": owner.get("name", owner.get("email", "")) if owner else owner_id,
        },
        "role": get_user_role(current_user["user_id"]),
    }


@router.post("/invite")
def invite_member(req: InviteRequest, current_user: dict = Depends(get_current_user)):
    from app.services.workspace_service import can, get_user_role
    role = get_user_role(current_user["user_id"])
    if not can(role, "manage_team"):
        raise HTTPException(status_code=403, detail="You don't have permission to invite members.")

    if not _valid_role(req.role):
        raise HTTPException(status_code=400, detail=f"Invalid role '{req.role}'. Use admin, analyst, or viewer.")

    owner_id = current_user["user_id"]
    members: list = kv_get(_members_key(owner_id)) or []

    if any(m["email"] == req.email for m in members):
        raise HTTPException(status_code=400, detail="This email has already been invited.")

    if req.email == current_user.get("email"):
        raise HTTPException(status_code=400, detail="You cannot invite yourself.")

    invite_token = str(uuid.uuid4())
    kv_set(f"workspace_invite_{invite_token}", {
        "owner_id": owner_id,
        "email": req.email,
        "role": req.role,
        "expires_at": time.time() + _INVITE_TTL,
    })

    new_member = {
        "id": str(uuid.uuid4()),
        "email": req.email,
        "name": req.email.split("@")[0],
        "role": req.role,
        "status": "pending",
        "invited_at": datetime.utcnow().isoformat(),
        "joined_at": None,
        "user_id": None,
        "avatar_letter": req.email[0].upper(),
        "last_active": "Invited",
    }
    members.append(new_member)
    kv_set(_members_key(owner_id), members)

    owner_name = current_user.get("name", current_user.get("email", "Someone"))
    join_url   = f"http://localhost:5173/join?token={invite_token}"

    # ── In-app notification (if the invitee already has an account) ───────────
    invitee_user = get_user_by_email(req.email)
    if invitee_user and not invitee_user.get("deleted_at"):
        try:
            from app.storage import insert_notifications
            insert_notifications({
                "notification_id": str(uuid.uuid4()),
                "user_id": invitee_user["user_id"],
                "file_id": "",
                "title": f"Workspace invitation from {owner_name}",
                "message": (
                    f"{owner_name} has invited you to join their BizInsight AI workspace "
                    f"as a {req.role.capitalize()}. "
                    f"Open the link to accept: {join_url}"
                ),
                "severity": "info",
                "type": "workspace_invite",
                "read": False,
                "created_at": datetime.utcnow().isoformat(),
                "metadata": {
                    "invite_token": invite_token,
                    "role": req.role,
                    "owner_id": owner_id,
                    "join_url": join_url,
                },
            })
        except Exception as exc:
            logger.warning("In-app invite notification failed: %s", exc)

    # ── Email invite (non-blocking) ───────────────────────────────────────────
    try:
        _send_invite_email(
            invitee_email=req.email,
            owner_name=owner_name,
            role=req.role,
            token=invite_token,
        )
        logger.info("Invite email sent to %s for workspace %s", req.email, owner_id)
    except Exception as exc:
        logger.warning("Invite email failed: %s", exc)

    return {"success": True, "member": new_member}


# ── Public: validate + accept invite token ────────────────────────────────────

@router.get("/join/{token}")
def preview_invite(token: str):
    """Public endpoint — validate an invite token and return its details."""
    record = kv_get(f"workspace_invite_{token}")
    if not record or record.get("expires_at", 0) < time.time():
        raise HTTPException(status_code=400, detail="This invitation link is invalid or has expired.")
    owner = get_user_by_id(record["owner_id"])
    return {
        "valid": True,
        "email": record["email"],
        "role": record["role"],
        "owner_name": owner.get("name", owner.get("email", "")) if owner else "Unknown",
    }


@router.post("/join/{token}")
def accept_invite(token: str, current_user: dict = Depends(get_current_user)):
    """Accept an invitation. The caller must be logged in."""
    from app.services.workspace_service import record_member_join

    record = kv_get(f"workspace_invite_{token}")
    if not record or record.get("expires_at", 0) < time.time():
        raise HTTPException(status_code=400, detail="This invitation link is invalid or has expired.")

    # The email in the invite must match the logged-in user's email
    if record["email"].lower() != current_user["email"].lower():
        raise HTTPException(
            status_code=403,
            detail=f"This invitation was sent to {record['email']}. Please log in with that account.",
        )

    owner_id = record["owner_id"]
    members: list = kv_get(_members_key(owner_id)) or []

    # Mark the member as accepted
    for m in members:
        if m["email"].lower() == current_user["email"].lower():
            m["status"] = "accepted"
            m["user_id"] = current_user["user_id"]
            m["joined_at"] = datetime.utcnow().isoformat()
            m["name"] = current_user.get("name", m["name"])
            m["last_active"] = "just now"
            break
    else:
        # Member record not found — create it (link-based join)
        members.append({
            "id": str(uuid.uuid4()),
            "email": current_user["email"],
            "name": current_user.get("name", current_user["email"].split("@")[0]),
            "role": record["role"],
            "status": "accepted",
            "invited_at": datetime.utcnow().isoformat(),
            "joined_at": datetime.utcnow().isoformat(),
            "user_id": current_user["user_id"],
            "avatar_letter": current_user["email"][0].upper(),
            "last_active": "just now",
        })

    kv_set(_members_key(owner_id), members)
    kv_delete(f"workspace_invite_{token}")           # one-time use
    record_member_join(current_user["user_id"], owner_id)

    owner = get_user_by_id(owner_id)
    return {
        "success": True,
        "role": record["role"],
        "owner_name": owner.get("name", owner.get("email", "")) if owner else "",
    }


# ── Member management ─────────────────────────────────────────────────────────

@router.patch("/members/{member_id}")
def update_member(member_id: str, patch: MemberPatch, current_user: dict = Depends(get_current_user)):
    from app.services.workspace_service import can, get_user_role
    if not can(get_user_role(current_user["user_id"]), "manage_team"):
        raise HTTPException(status_code=403, detail="You don't have permission to manage team members.")

    owner_id = current_user["user_id"]
    members: list = kv_get(_members_key(owner_id)) or []
    for m in members:
        if m["id"] == member_id:
            if patch.role:
                if not _valid_role(patch.role):
                    raise HTTPException(status_code=400, detail="Invalid role.")
                m["role"] = patch.role
                # Update reverse-lookup if member has joined
                if m.get("user_id"):
                    from app.storage import kv_set as _kv_set
                    # Role is re-read live from the members list, no extra key needed
            kv_set(_members_key(owner_id), members)
            return {"success": True, "member": m}
    raise HTTPException(status_code=404, detail="Member not found.")


@router.delete("/members/{member_id}")
def remove_member(member_id: str, current_user: dict = Depends(get_current_user)):
    from app.services.workspace_service import can, get_user_role, record_member_leave
    if not can(get_user_role(current_user["user_id"]), "manage_team"):
        raise HTTPException(status_code=403, detail="You don't have permission to remove members.")

    owner_id = current_user["user_id"]
    members: list = kv_get(_members_key(owner_id)) or []
    removed = next((m for m in members if m["id"] == member_id), None)
    if not removed:
        raise HTTPException(status_code=404, detail="Member not found.")

    new_members = [m for m in members if m["id"] != member_id]
    kv_set(_members_key(owner_id), new_members)

    # Clear reverse-lookup if they had joined
    if removed.get("user_id"):
        record_member_leave(removed["user_id"])

    return {"success": True}


# ── Invite link (shareable, role=analyst) ─────────────────────────────────────

@router.get("/invite-link")
def get_invite_link(current_user: dict = Depends(get_current_user)):
    from app.services.workspace_service import can, get_user_role
    if not can(get_user_role(current_user["user_id"]), "manage_team"):
        raise HTTPException(status_code=403, detail="Only admins and owners can generate invite links.")

    # Reuse existing link token if still valid
    existing = kv_get(f"workspace_link_token_{current_user['user_id']}")
    if existing and existing.get("expires_at", 0) > time.time():
        token = existing["token"]
    else:
        token = str(uuid.uuid4())
        kv_set(f"workspace_link_token_{current_user['user_id']}", {
            "token": token,
            "expires_at": time.time() + _LINK_TTL,
        })
        # Register as a link-type invite (no specific email)
        kv_set(f"workspace_invite_{token}", {
            "owner_id": current_user["user_id"],
            "email": "__any__",      # any registered user can use link invites
            "role": "analyst",
            "expires_at": time.time() + _LINK_TTL,
            "link_type": True,
        })

    link = f"{f'http://localhost:5173'}/join?token={token}"
    return {"link": link, "token": token, "expires_in_days": 7}


