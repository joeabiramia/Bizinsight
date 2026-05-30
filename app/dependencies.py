from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth_utils import verify_token
from app.storage import get_user_by_id

security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = verify_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_user_by_id(payload["user_id"])
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("deleted_at"):
        raise HTTPException(status_code=401, detail="This account has been deleted.")
    return user


# ── Workspace-aware user ──────────────────────────────────────────────────────

def get_workspace_user(current_user: dict = Depends(get_current_user)) -> dict:
    """Return the current user dict enriched with workspace role and effective owner ID.

    Extra fields added:
      workspace_role      – "owner" | "admin" | "analyst" | "viewer"
      effective_owner_id  – user_id to use for file/data operations
    """
    from app.services.workspace_service import get_user_role, get_effective_owner_id
    user_id = current_user["user_id"]
    role = get_user_role(user_id)
    eff_id = get_effective_owner_id(user_id)
    return {**current_user, "workspace_role": role, "effective_owner_id": eff_id}


# ── Role enforcement dependencies ─────────────────────────────────────────────

def require_analyst(wu: dict = Depends(get_workspace_user)) -> dict:
    """Allow owner, admin, analyst. Block viewer."""
    from app.services.workspace_service import can
    if not can(wu["workspace_role"], "analyze"):
        raise HTTPException(
            status_code=403,
            detail="Viewers cannot perform this action. Ask your workspace owner to upgrade your role.",
        )
    return wu


def require_admin(wu: dict = Depends(get_workspace_user)) -> dict:
    """Allow owner and admin only."""
    from app.services.workspace_service import can
    if not can(wu["workspace_role"], "manage_team"):
        raise HTTPException(
            status_code=403,
            detail="Only admins and owners can perform this action.",
        )
    return wu
