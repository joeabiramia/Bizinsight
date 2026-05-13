"""AI Goal Tracking Service.

Calculates progress toward user-defined business goals using real data.
"""
from __future__ import annotations

import pandas as pd

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders"]
_CUSTOMER_SYNS = ["customer", "client", "buyer", "account"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


GOAL_TYPES = [
    {"id": "revenue", "label": "Revenue Target", "unit": "$", "icon": "💰"},
    {"id": "sales_count", "label": "Sales / Orders Target", "unit": "orders", "icon": "📦"},
    {"id": "avg_order_value", "label": "Average Order Value Target", "unit": "$", "icon": "🛒"},
    {"id": "customer_count", "label": "Unique Customers Target", "unit": "customers", "icon": "👥"},
    {"id": "quantity", "label": "Total Units Sold Target", "unit": "units", "icon": "📊"},
]


def calculate_goal_progress(goal: dict, df: pd.DataFrame) -> dict:
    """Calculate real progress toward a business goal from actual data."""
    goal_type = goal.get("goal_type", "revenue")
    target_value = float(goal.get("target_value", 0))

    if target_value <= 0:
        return {
            "current_value": 0,
            "target_value": 0,
            "progress_pct": 0,
            "status": "no_target",
            "gap": 0,
            "column_used": None,
            "ai_recommendation": "Please set a target value for this goal.",
        }

    current_value = 0.0
    column_used = None

    if goal_type == "revenue":
        col = _find_col(df, _REVENUE_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used = col

    elif goal_type == "sales_count":
        current_value = float(len(df))
        column_used = "row_count"

    elif goal_type == "avg_order_value":
        col = _find_col(df, _REVENUE_SYNS)
        if col:
            vals = df[col].apply(safe_number).dropna()
            current_value = float(vals.mean()) if not vals.empty else 0.0
            column_used = col

    elif goal_type == "customer_count":
        col = _find_col(df, _CUSTOMER_SYNS)
        if col:
            current_value = float(df[col].nunique())
            column_used = col

    elif goal_type == "quantity":
        col = _find_col(df, _QTY_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used = col

    progress_pct = min(100.0, current_value / target_value * 100) if target_value > 0 else 0.0
    gap = target_value - current_value

    if progress_pct >= 100:
        status = "achieved"
    elif progress_pct >= 80:
        status = "on_track"
    elif progress_pct >= 50:
        status = "at_risk"
    else:
        status = "behind"

    if status == "achieved":
        rec = f"Goal achieved! You exceeded your target by ${abs(gap):,.2f}. Consider raising the target."
    elif status == "on_track":
        rec = f"At {progress_pct:.1f}% of target. Maintain current momentum to hit goal."
    elif status == "at_risk":
        rec = (
            f"At {progress_pct:.1f}% with ${gap:,.2f} remaining. "
            "Focus on top-performing segments to accelerate progress."
        )
    else:
        rec = (
            f"At {progress_pct:.1f}% with ${gap:,.2f} remaining. "
            "Urgently review strategy in underperforming areas. "
            "Consider increasing activity in your highest-performing channels."
        )

    return {
        "current_value": round(current_value, 2),
        "target_value": round(target_value, 2),
        "progress_pct": round(progress_pct, 2),
        "status": status,
        "gap": round(gap, 2),
        "column_used": column_used,
        "ai_recommendation": rec,
    }
