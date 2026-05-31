"""AI Goal Tracking endpoints."""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import (
    delete_goal,
    get_file_record_for_user,
    get_goals_for_user,
    insert_goal,
    update_goal,
)
from app.services.audit_service import log_action
from app.services.goals_service import get_goal_types_for_industry

router = APIRouter(prefix="/goals", tags=["goals"])
logger = logging.getLogger(__name__)


class CreateGoalRequest(BaseModel):
    name: str
    goal_type: str
    target_value: float
    description: str = ""
    deadline: str = ""


class UpdateGoalRequest(BaseModel):
    name: str | None = None
    target_value: float | None = None
    description: str | None = None
    deadline: str | None = None


@router.get("/types")
def list_goal_types(
    industry: str = Query("", description="Industry slug to filter goal types (e.g. retail, hr, technology)"),
):
    types = get_goal_types_for_industry(industry)
    return {"goal_types": types, "industry": industry or "general"}


@router.get("")
def list_goals(wu: dict = Depends(get_workspace_user)):
    goals = get_goals_for_user(wu["user_id"])
    return {"goals": goals, "total": len(goals)}


@router.post("")
def create_goal(
    body: CreateGoalRequest,
    wu: dict = Depends(get_workspace_user),
):
    goal = {
        "goal_id": str(uuid.uuid4()),
        "user_id": wu["user_id"],
        "name": body.name,
        "goal_type": body.goal_type,
        "target_value": body.target_value,
        "description": body.description,
        "deadline": body.deadline,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    insert_goal(goal)
    log_action(wu["user_id"], "goal_created", "goal", goal["goal_id"], {"name": body.name})
    return {"goal": goal, "message": "Goal created successfully"}


@router.put("/{goal_id}")
def update_goal_endpoint(
    goal_id: str,
    body: UpdateGoalRequest,
    wu: dict = Depends(get_workspace_user),
):
    updates: dict = {"updated_at": datetime.utcnow().isoformat()}
    if body.name is not None:
        updates["name"] = body.name
    if body.target_value is not None:
        updates["target_value"] = body.target_value
    if body.description is not None:
        updates["description"] = body.description
    if body.deadline is not None:
        updates["deadline"] = body.deadline

    updated = update_goal(goal_id, wu["user_id"], updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Goal not found")
    log_action(wu["user_id"], "goal_updated", "goal", goal_id)
    return {"message": "Goal updated successfully"}


@router.delete("/{goal_id}")
def delete_goal_endpoint(
    goal_id: str,
    wu: dict = Depends(get_workspace_user),
):
    deleted = delete_goal(goal_id, wu["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Goal not found")
    log_action(wu["user_id"], "goal_deleted", "goal", goal_id)
    return {"message": "Goal deleted"}


@router.get("/{goal_id}/progress/{file_id}")
def get_goal_progress(
    goal_id: str,
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Calculate real progress toward a goal from actual dataset."""
    goals = get_goals_for_user(wu["user_id"])
    goal = next((g for g in goals if g.get("goal_id") == goal_id), None)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    from app.services.goals_service import calculate_goal_progress
    progress = calculate_goal_progress(goal, df)
    return {"goal_id": goal_id, "file_id": file_id, **progress}


@router.get("/all-progress/{file_id}")
def get_all_goals_progress(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Get progress for all goals against a dataset."""
    goals = get_goals_for_user(wu["user_id"])
    if not goals:
        return {"goals": [], "total": 0}

    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    from app.services.goals_service import calculate_goal_progress
    results = []
    for goal in goals:
        try:
            progress = calculate_goal_progress(goal, df)
            results.append({**goal, "progress": progress})
        except Exception:
            results.append({**goal, "progress": None})

    return {"goals": results, "file_id": file_id, "total": len(results)}
