"""Workspace service — role resolution and permission checks.

Role hierarchy (most → least privileged):
  owner   – full control, billing, team management
  admin   – manage datasets, rules, integrations, invite members
  analyst – upload data, run analysis, AI chat
  viewer  – read-only: view analysis results and dashboards

Reverse-lookup key:  workspace_member_of_{user_id} = owner_user_id
This lets any route cheaply discover which workspace a user belongs to.
"""
from __future__ import annotations

from app.storage import kv_get, kv_set

_ROLE_RANK = {"owner": 4, "admin": 3, "analyst": 2, "viewer": 1}

# ── Lookup helpers ────────────────────────────────────────────────────────────

def get_user_workspace_owner(user_id: str) -> str | None:
    """Return the workspace owner's user_id if *user_id* is a member; else None."""
    return kv_get(f"workspace_member_of_{user_id}")


def get_user_role(user_id: str) -> str:
    """Return the effective role for *user_id*.

    - Returns "owner" if the user owns their own workspace or is not in any workspace.
    - Returns the actual role if they are a member of someone else's workspace.
    """
    owner_id = get_user_workspace_owner(user_id)
    if not owner_id:
        return "owner"
    members: list = kv_get(f"workspace_members_{owner_id}") or []
    for m in members:
        if m.get("user_id") == user_id and m.get("status") == "accepted":
            return m.get("role", "viewer")
    return "viewer"  # invited but not yet accepted, treat as viewer


def get_effective_owner_id(user_id: str) -> str:
    """Return the user_id whose datasets/data should be used for file operations.

    Workspace members transparently operate on the workspace owner's data.
    """
    owner_id = get_user_workspace_owner(user_id)
    return owner_id if owner_id else user_id


def record_member_join(member_user_id: str, owner_user_id: str) -> None:
    """Store the reverse-lookup so future requests resolve workspace membership."""
    kv_set(f"workspace_member_of_{member_user_id}", owner_user_id)


def record_member_leave(member_user_id: str) -> None:
    from app.storage import kv_delete
    kv_delete(f"workspace_member_of_{member_user_id}")


# ── Permission checks ─────────────────────────────────────────────────────────

def can(role: str, action: str) -> bool:
    """Return True if *role* is allowed to perform *action*.

    Actions
    -------
    upload          – upload a dataset
    analyze         – run analysis / AI chat / predictions
    view            – view any analysis result or dashboard
    delete_dataset  – delete a dataset
    manage_team     – invite / remove members, change roles
    manage_settings – workspace branding and owner-level settings
    """
    rank = _ROLE_RANK.get(role, 0)
    rules = {
        "upload":           2,   # analyst+
        "analyze":          2,   # analyst+
        "view":             1,   # viewer+
        "delete_dataset":   3,   # admin+
        "manage_team":      3,   # admin+
        "manage_settings":  4,   # owner only
    }
    return rank >= rules.get(action, 99)
