"""Workflow Automation Engine endpoints."""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import (
    delete_automation_rule,
    get_automation_history_for_user,
    get_automation_rule,
    get_automation_rules_for_user,
    get_file_record_for_user,
    insert_automation_history,
    insert_automation_rule,
    update_automation_rule,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/automation", tags=["automation"])
logger = logging.getLogger(__name__)


class CreateRuleRequest(BaseModel):
    name: str
    condition_id: str
    params: dict = {}
    action_id: str
    action_message: str = ""
    active: bool = True


class UpdateRuleRequest(BaseModel):
    name: str | None = None
    condition_id: str | None = None
    params: dict | None = None
    action_id: str | None = None
    action_message: str | None = None
    active: bool | None = None


@router.get("/conditions")
def list_conditions():
    """Return available rule condition types."""
    from app.services.automation_service import AVAILABLE_CONDITIONS
    return {"conditions": AVAILABLE_CONDITIONS}


@router.get("/actions")
def list_actions():
    """Return available rule action types."""
    from app.services.automation_service import AVAILABLE_ACTIONS
    return {"actions": AVAILABLE_ACTIONS}


@router.get("/rules")
def list_rules(current_user: dict = Depends(get_current_user)):
    rules = get_automation_rules_for_user(current_user["user_id"])
    return {"rules": rules, "total": len(rules)}


@router.post("/rules")
def create_rule(
    body: CreateRuleRequest,
    current_user: dict = Depends(get_current_user),
):
    rule = {
        "rule_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "name": body.name,
        "condition_id": body.condition_id,
        "params": body.params,
        "action_id": body.action_id,
        "action_message": body.action_message,
        "active": body.active,
        "created_at": datetime.utcnow().isoformat(),
        "trigger_count": 0,
    }
    insert_automation_rule(rule)
    log_action(current_user["user_id"], "rule_created", "rule", rule["rule_id"], {"name": body.name})
    return {"rule": rule, "message": "Automation rule created successfully"}


@router.put("/rules/{rule_id}")
def update_rule(
    rule_id: str,
    body: UpdateRuleRequest,
    current_user: dict = Depends(get_current_user),
):
    existing = get_automation_rule(rule_id, current_user["user_id"])
    if not existing:
        raise HTTPException(status_code=404, detail="Rule not found")
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    update_automation_rule(rule_id, current_user["user_id"], patch)
    updated = {**existing, **patch}
    log_action(current_user["user_id"], "rule_updated", "rule", rule_id, patch)
    return {"rule": updated, "message": "Rule updated successfully"}


@router.delete("/rules/{rule_id}")
def delete_rule(
    rule_id: str,
    current_user: dict = Depends(get_current_user),
):
    deleted = delete_automation_rule(rule_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    log_action(current_user["user_id"], "rule_deleted", "rule", rule_id)
    return {"message": "Rule deleted"}


@router.post("/trigger/{file_id}")
def trigger_automation(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Evaluate all active rules against the dataset and execute triggered actions."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    rules = get_automation_rules_for_user(current_user["user_id"])
    if not rules:
        return {"triggered_count": 0, "results": [], "message": "No automation rules configured"}

    from app.services.automation_service import run_automations
    results = run_automations(rules, df)
    triggered = [r for r in results if r.get("triggered")]

    # Execute actions for triggered rules
    for result in triggered:
        action_id = result.get("action_id", "")
        if action_id in ("create_notification", "create_critical_alert"):
            try:
                from app.storage import insert_notifications
                severity = "critical" if action_id == "create_critical_alert" else "warning"
                notif = {
                    "notification_id": str(uuid.uuid4()),
                    "user_id": current_user["user_id"],
                    "file_id": file_id,
                    "title": f"Automation: {result['rule_name']}",
                    "message": result["reason"],
                    "severity": severity,
                    "type": "automation",
                    "read": False,
                    "created_at": datetime.utcnow().isoformat(),
                    "metadata": result.get("action_data", {}),
                }
                insert_notifications(notif)
            except Exception as exc:
                logger.warning("Could not create automation notification: %s", exc)

        # Record to history
        history_entry = {
            "history_id": str(uuid.uuid4()),
            "user_id": current_user["user_id"],
            "file_id": file_id,
            "rule_id": result.get("rule_id"),
            "rule_name": result.get("rule_name"),
            "condition_id": result.get("condition_id"),
            "action_id": action_id,
            "triggered": True,
            "reason": result.get("reason"),
            "triggered_at": datetime.utcnow().isoformat(),
        }
        insert_automation_history(history_entry)

    if triggered:
        log_action(
            current_user["user_id"],
            "automation_triggered",
            "file",
            file_id,
            {"triggered_count": len(triggered)},
        )

    return {
        "file_id": file_id,
        "total_rules_evaluated": len(results),
        "triggered_count": len(triggered),
        "results": results,
        "triggered_rules": [r["rule_name"] for r in triggered],
        "message": (
            f"{len(triggered)} rule(s) triggered out of {len(results)} evaluated"
            if triggered else "No rules triggered — all conditions within normal range"
        ),
    }


@router.get("/history")
def get_history(current_user: dict = Depends(get_current_user)):
    history = get_automation_history_for_user(current_user["user_id"])
    return {"history": history, "total": len(history)}
