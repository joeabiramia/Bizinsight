"""Audit Log Service.

Tracks all important user and system actions for compliance and transparency.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

ACTION_LABELS = {
    "file_uploaded": "File Uploaded",
    "report_generated": "Report Generated",
    "insight_created": "AI Insight Created",
    "notification_triggered": "Notification Triggered",
    "rule_created": "Automation Rule Created",
    "rule_deleted": "Automation Rule Deleted",
    "automation_triggered": "Automation Rule Triggered",
    "data_cleaned": "Data Cleaned",
    "dashboard_shared": "Dashboard Shared",
    "goal_created": "Goal Created",
    "goal_updated": "Goal Updated",
    "goal_deleted": "Goal Deleted",
    "strategy_generated": "Strategy Generated",
    "fraud_scan": "Fraud Scan Completed",
    "login": "User Login",
    "logout": "User Logout",
    "data_exported": "Data Exported",
    "analysis_run": "Analysis Run",
    "prediction_run": "Prediction Run",
    "scenario_run": "Scenario Simulated",
    "data_cleaning_applied": "Data Cleaning Applied",
    "market_intel_viewed": "Market Intelligence Viewed",
}

RESOURCE_ICONS = {
    "file": "📄",
    "report": "📊",
    "insight": "💡",
    "notification": "🔔",
    "rule": "⚙️",
    "goal": "🎯",
    "strategy": "🗺️",
    "fraud_scan": "🔍",
    "analysis": "📈",
    "user": "👤",
    "dataset": "🗂️",
}


def create_audit_entry(
    user_id: str,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    metadata: dict | None = None,
    ip_address: str = "",
) -> dict:
    return {
        "audit_id": str(uuid.uuid4()),
        "user_id": user_id,
        "action": action,
        "action_label": ACTION_LABELS.get(action, action.replace("_", " ").title()),
        "resource_type": resource_type,
        "resource_id": resource_id,
        "resource_icon": RESOURCE_ICONS.get(resource_type, "📝"),
        "metadata": metadata or {},
        "ip_address": ip_address,
        "created_at": datetime.utcnow().isoformat(),
    }


def log_action(
    user_id: str,
    action: str,
    resource_type: str = "",
    resource_id: str = "",
    metadata: dict | None = None,
) -> dict | None:
    """Persist an audit log entry. Silently fails to never block main flows."""
    try:
        from app.storage import insert_audit_log
        entry = create_audit_entry(user_id, action, resource_type, resource_id, metadata)
        insert_audit_log(entry)
        return entry
    except Exception as exc:
        logger.warning("Audit log write failed: %s", exc)
        return None
