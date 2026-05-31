"""AI Goal Tracking Service.

Goal types are industry-aware: each industry sees only the goals that
make sense for their data.  `get_goal_types_for_industry()` returns the
right subset; `calculate_goal_progress()` handles them all.
"""
from __future__ import annotations

import pandas as pd

from app.dataframe_utils import safe_number


# ── Column detection helpers ───────────────────────────────────────────────────

_REVENUE_SYNS   = ["revenue", "sales", "total_sales", "amount", "income", "value", "mrr", "arr"]
_QTY_SYNS       = ["quantity", "qty", "units", "volume", "orders", "bookings"]
_CUSTOMER_SYNS  = ["customer", "client", "buyer", "account", "patron"]
_EMPLOYEE_SYNS  = ["employee", "staff", "worker", "headcount", "fte"]
_COST_SYNS      = ["cost", "expense", "cogs", "freight", "spend"]
_CHURN_SYNS     = ["churn", "churn_rate", "attrition", "turnover"]
_DEFECT_SYNS    = ["defect", "defect_rate", "defects", "reject", "scrap"]
_OEE_SYNS       = ["oee", "effectiveness", "efficiency", "utilization"]
_DAYS_SYNS      = ["days", "duration", "lead_time", "hire_days", "transit_days"]
_USER_SYNS      = ["users", "active_users", "mau", "dau", "accounts", "seats"]
_STATUS_SYNS    = ["status", "state", "outcome", "result", "flag"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


# ── Goal type catalogue ────────────────────────────────────────────────────────
# Each entry: id, label, unit, icon, industries, lower_is_better (optional)

_ALL_GOAL_TYPES = [
    # ── Universal ──────────────────────────────────────────────────────────────
    {"id": "revenue",           "label": "Revenue Target",               "unit": "$",          "icon": "💰", "industries": ["retail", "finance", "travel", "general"]},
    {"id": "data_rows",         "label": "Record Count Target",          "unit": "records",    "icon": "📋", "industries": ["general"]},

    # ── Retail & E-commerce ────────────────────────────────────────────────────
    {"id": "sales_count",       "label": "Orders Target",                "unit": "orders",     "icon": "📦", "industries": ["retail"]},
    {"id": "avg_order_value",   "label": "Average Order Value Target",   "unit": "$",          "icon": "🛒", "industries": ["retail", "travel"]},
    {"id": "customer_count",    "label": "Unique Customers Target",      "unit": "customers",  "icon": "👥", "industries": ["retail", "travel", "finance"]},
    {"id": "quantity",          "label": "Units Sold Target",            "unit": "units",      "icon": "📊", "industries": ["retail", "manufacturing"]},

    # ── SaaS / Technology ──────────────────────────────────────────────────────
    {"id": "mrr",               "label": "Monthly Recurring Revenue (MRR) Target", "unit": "$", "icon": "📈", "industries": ["technology"]},
    {"id": "arr",               "label": "Annual Recurring Revenue (ARR) Target",  "unit": "$", "icon": "📅", "industries": ["technology"]},
    {"id": "churn_rate",        "label": "Churn Rate Target",            "unit": "%",          "icon": "🔄", "industries": ["technology"], "lower_is_better": True},
    {"id": "active_users",      "label": "Active Users Target",          "unit": "users",      "icon": "👤", "industries": ["technology"]},
    {"id": "new_customers",     "label": "New Customer Acquisition Target", "unit": "customers","icon": "➕", "industries": ["technology", "finance"]},
    {"id": "cac",               "label": "Customer Acquisition Cost Target", "unit": "$",      "icon": "💳", "industries": ["technology"], "lower_is_better": True},

    # ── HR & Workforce ─────────────────────────────────────────────────────────
    {"id": "headcount",         "label": "Total Headcount Target",       "unit": "employees",  "icon": "👥", "industries": ["hr"]},
    {"id": "new_hires",         "label": "New Hires Target",             "unit": "employees",  "icon": "➕", "industries": ["hr"]},
    {"id": "turnover_rate",     "label": "Employee Turnover Rate Target","unit": "%",           "icon": "🚪", "industries": ["hr"], "lower_is_better": True},
    {"id": "time_to_hire",      "label": "Time-to-Hire Target",          "unit": "days",       "icon": "📅", "industries": ["hr"], "lower_is_better": True},
    {"id": "employee_sat",      "label": "Employee Satisfaction Score",  "unit": "pts",        "icon": "⭐", "industries": ["hr"]},

    # ── Financial Services ─────────────────────────────────────────────────────
    {"id": "profit_margin",     "label": "Profit Margin Target",         "unit": "%",          "icon": "📊", "industries": ["finance"]},
    {"id": "cost_reduction",    "label": "Cost Reduction Target",        "unit": "$",          "icon": "📉", "industries": ["finance"]},
    {"id": "expense_ratio",     "label": "Expense Ratio Target",         "unit": "%",          "icon": "⚖️","industries": ["finance"], "lower_is_better": True},
    {"id": "transaction_volume","label": "Transaction Volume Target",    "unit": "transactions","icon": "🏦", "industries": ["finance"]},

    # ── Logistics & Supply Chain ───────────────────────────────────────────────
    {"id": "shipment_volume",   "label": "Shipment Volume Target",       "unit": "shipments",  "icon": "🚚", "industries": ["logistics"]},
    {"id": "delivery_rate",     "label": "On-Time Delivery Rate Target", "unit": "%",          "icon": "✅", "industries": ["logistics"]},
    {"id": "cost_per_shipment", "label": "Cost per Shipment Target",     "unit": "$",          "icon": "💰", "industries": ["logistics"], "lower_is_better": True},

    # ── Manufacturing ──────────────────────────────────────────────────────────
    {"id": "production_output", "label": "Production Output Target",     "unit": "units",      "icon": "🏭", "industries": ["manufacturing"]},
    {"id": "defect_rate",       "label": "Defect Rate Target",           "unit": "%",          "icon": "🔧", "industries": ["manufacturing"], "lower_is_better": True},
    {"id": "oee",               "label": "Equipment Effectiveness (OEE) Target", "unit": "%", "icon": "⚙️", "industries": ["manufacturing"]},

    # ── Travel & Hospitality ───────────────────────────────────────────────────
    {"id": "booking_count",     "label": "Booking Volume Target",        "unit": "bookings",   "icon": "✈️", "industries": ["travel"]},
    {"id": "cancellation_rate", "label": "Cancellation Rate Target",     "unit": "%",          "icon": "❌", "industries": ["travel"], "lower_is_better": True},
    {"id": "agent_bookings",    "label": "Agent Productivity Target",    "unit": "bookings/agent", "icon": "🧑‍💼", "industries": ["travel"]},
]

# Backward-compatible list (all types) used when no industry filter is applied
GOAL_TYPES = _ALL_GOAL_TYPES


def get_goal_types_for_industry(industry: str) -> list[dict]:
    """Return goal types relevant to the given industry."""
    ind = (industry or "").lower().strip()
    if not ind or ind == "general":
        return _ALL_GOAL_TYPES

    result = [g for g in _ALL_GOAL_TYPES if "general" in g.get("industries", []) or ind in g.get("industries", [])]
    return result if result else _ALL_GOAL_TYPES


# ── Progress calculator ────────────────────────────────────────────────────────

def _pct_progress(current: float, target: float, lower_is_better: bool = False) -> float:
    """Return progress % toward target, capped at 100."""
    if target <= 0:
        return 0.0
    if lower_is_better:
        # For "lower is better" goals: if current <= target → 100%, linearly degrade above
        if current <= 0:
            return 100.0
        return min(100.0, max(0.0, (target / current) * 100))
    return min(100.0, current / target * 100)


def _recommendation(progress_pct: float, gap: float, goal_type_meta: dict | None,
                    lower_is_better: bool) -> str:
    label = (goal_type_meta or {}).get("label", "goal")
    unit  = (goal_type_meta or {}).get("unit", "")

    def _fmt(v: float) -> str:
        if unit == "$":
            return f"${abs(v):,.2f}"
        return f"{abs(v):,.1f} {unit}"

    if lower_is_better:
        if progress_pct >= 100:
            return f"Target achieved — your {label} is at or below the target. Maintain this performance."
        elif progress_pct >= 75:
            return f"On track — {label} is close to target. Small improvements will close the gap."
        else:
            return f"Attention needed — {label} is {_fmt(gap)} above target. Investigate root causes and prioritise corrective action."
    else:
        if progress_pct >= 100:
            return f"Goal achieved! You exceeded your {label} by {_fmt(abs(gap))}. Consider raising the target."
        elif progress_pct >= 80:
            return f"At {progress_pct:.1f}% of target. Maintain current momentum to hit goal."
        elif progress_pct >= 50:
            return f"At {progress_pct:.1f}% with {_fmt(gap)} remaining. Focus on top-performing segments to accelerate progress."
        else:
            return f"At {progress_pct:.1f}% with {_fmt(gap)} remaining. Urgently review strategy and double down on highest-performing areas."


def calculate_goal_progress(goal: dict, df: pd.DataFrame) -> dict:  # noqa: C901
    """Calculate real progress toward any business goal from actual data."""
    goal_type    = goal.get("goal_type", "revenue")
    target_value = float(goal.get("target_value", 0))

    # Find the goal type metadata for labels / units
    goal_meta = next((g for g in _ALL_GOAL_TYPES if g["id"] == goal_type), None)
    lower_is_better = (goal_meta or {}).get("lower_is_better", False)

    if target_value <= 0:
        return {
            "current_value": 0, "target_value": 0, "progress_pct": 0,
            "status": "no_target", "gap": 0, "column_used": None,
            "ai_recommendation": "Please set a target value for this goal.",
        }

    current_value = 0.0
    column_used   = None

    # ── Revenue / MRR / ARR ───────────────────────────────────────────────────
    if goal_type in ("revenue", "mrr", "arr", "booking_revenue"):
        col = _find_col(df, _REVENUE_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    # ── Count-based ───────────────────────────────────────────────────────────
    elif goal_type in ("sales_count", "booking_count", "transaction_volume"):
        current_value = float(len(df))
        column_used   = "row_count"

    elif goal_type == "data_rows":
        current_value = float(len(df))
        column_used   = "row_count"

    elif goal_type == "quantity":
        col = _find_col(df, _QTY_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    elif goal_type == "shipment_volume":
        col = _find_col(df, ["shipments", "packages", "parcels"] + _QTY_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    elif goal_type == "production_output":
        col = _find_col(df, ["production", "units_produced", "output"] + _QTY_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    # ── Average-based ─────────────────────────────────────────────────────────
    elif goal_type in ("avg_order_value", "avg_booking_value"):
        col = _find_col(df, _REVENUE_SYNS)
        if col:
            vals = df[col].apply(safe_number).dropna()
            current_value = float(vals.mean()) if not vals.empty else 0.0
            column_used   = col

    elif goal_type == "cost_per_shipment":
        col = _find_col(df, _COST_SYNS)
        if col:
            vals = df[col].apply(safe_number).dropna()
            current_value = float(vals.mean()) if not vals.empty else 0.0
            column_used   = col

    elif goal_type == "cac":
        col = _find_col(df, ["cac", "acquisition_cost", "cost_per_customer"] + _COST_SYNS)
        if col:
            vals = df[col].apply(safe_number).dropna()
            current_value = float(vals.mean()) if not vals.empty else 0.0
            column_used   = col

    elif goal_type == "time_to_hire":
        col = _find_col(df, _DAYS_SYNS + ["hire_days", "days_to_hire"])
        if col:
            vals = df[col].apply(safe_number).dropna()
            current_value = float(vals.mean()) if not vals.empty else 0.0
            column_used   = col

    # ── Unique count ──────────────────────────────────────────────────────────
    elif goal_type in ("customer_count", "new_customers"):
        col = _find_col(df, _CUSTOMER_SYNS)
        if col:
            current_value = float(df[col].nunique())
            column_used   = col

    elif goal_type == "headcount":
        col = _find_col(df, _EMPLOYEE_SYNS)
        current_value = float(df[col].nunique()) if col else float(len(df))
        column_used   = col or "row_count"

    elif goal_type == "new_hires":
        # Count rows with hire/active status
        status_col = _find_col(df, _STATUS_SYNS)
        if status_col:
            hire_kws  = ["hired", "active", "onboarded", "joined", "new"]
            current_value = float(df[status_col].astype(str).str.lower().isin(hire_kws).sum())
            column_used   = status_col
        else:
            current_value = float(len(df))
            column_used   = "row_count"

    elif goal_type == "active_users":
        col = _find_col(df, _USER_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    elif goal_type == "agent_bookings":
        person_col = _find_col(df, ["agent", "advisor", "consultant"] + _EMPLOYEE_SYNS)
        qty_col    = _find_col(df, _QTY_SYNS)
        if person_col:
            n_agents = max(1, df[person_col].nunique())
            total_bk = float(df[qty_col].apply(safe_number).dropna().sum()) if qty_col else float(len(df))
            current_value = total_bk / n_agents
            column_used   = person_col

    # ── Rate / percentage ─────────────────────────────────────────────────────
    elif goal_type == "churn_rate":
        churn_col = _find_col(df, _CHURN_SYNS)
        if churn_col:
            current_value = float(df[churn_col].apply(safe_number).dropna().mean()) or 0.0
            column_used   = churn_col
        else:
            status_col = _find_col(df, _STATUS_SYNS)
            if status_col:
                kws = ["churned", "cancelled", "inactive", "lost"]
                current_value = df[status_col].astype(str).str.lower().isin(kws).mean() * 100
                column_used   = status_col

    elif goal_type == "turnover_rate":
        churn_col  = _find_col(df, _CHURN_SYNS)
        status_col = _find_col(df, _STATUS_SYNS)
        if churn_col:
            current_value = float(df[churn_col].apply(safe_number).dropna().mean()) or 0.0
            column_used   = churn_col
        elif status_col:
            kws = ["left", "resigned", "terminated", "inactive"]
            current_value = df[status_col].astype(str).str.lower().isin(kws).mean() * 100
            column_used   = status_col

    elif goal_type == "delivery_rate":
        status_col = _find_col(df, _STATUS_SYNS)
        if status_col:
            kws = ["delivered", "on_time", "completed", "success"]
            current_value = df[status_col].astype(str).str.lower().isin(kws).mean() * 100
            column_used   = status_col

    elif goal_type == "cancellation_rate":
        status_col = _find_col(df, _STATUS_SYNS)
        if status_col:
            kws = ["cancelled", "canceled", "voided", "refunded"]
            current_value = df[status_col].astype(str).str.lower().isin(kws).mean() * 100
            column_used   = status_col

    elif goal_type == "defect_rate":
        col = _find_col(df, _DEFECT_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().mean()) or 0.0
            column_used   = col
        else:
            status_col = _find_col(df, _STATUS_SYNS)
            if status_col:
                kws = ["defect", "reject", "fail", "failed", "scrap"]
                current_value = df[status_col].astype(str).str.lower().isin(kws).mean() * 100
                column_used   = status_col

    elif goal_type == "oee":
        col = _find_col(df, _OEE_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().mean()) or 0.0
            column_used   = col

    elif goal_type == "profit_margin":
        rev_col  = _find_col(df, _REVENUE_SYNS)
        cost_col = _find_col(df, _COST_SYNS)
        if rev_col and cost_col:
            rev  = df[rev_col].apply(safe_number).dropna().sum()
            cost = df[cost_col].apply(safe_number).dropna().sum()
            current_value = float((rev - cost) / rev * 100) if rev > 0 else 0.0
            column_used   = f"{rev_col} - {cost_col}"

    elif goal_type == "cost_reduction":
        col = _find_col(df, _COST_SYNS)
        if col:
            current_value = float(df[col].apply(safe_number).dropna().sum())
            column_used   = col

    elif goal_type == "expense_ratio":
        rev_col  = _find_col(df, _REVENUE_SYNS)
        cost_col = _find_col(df, _COST_SYNS)
        if rev_col and cost_col:
            rev  = df[rev_col].apply(safe_number).dropna().sum()
            cost = df[cost_col].apply(safe_number).dropna().sum()
            current_value = float(cost / rev * 100) if rev > 0 else 0.0
            column_used   = f"{cost_col} / {rev_col}"

    elif goal_type == "employee_sat":
        sat_col = _find_col(df, ["satisfaction", "nps", "score", "rating", "enps"])
        if sat_col:
            current_value = float(df[sat_col].apply(safe_number).dropna().mean()) or 0.0
            column_used   = sat_col

    # ── Progress & status ─────────────────────────────────────────────────────
    progress_pct = _pct_progress(current_value, target_value, lower_is_better)
    gap = target_value - current_value if not lower_is_better else current_value - target_value

    if progress_pct >= 100:
        status = "achieved"
    elif progress_pct >= 80:
        status = "on_track"
    elif progress_pct >= 50:
        status = "at_risk"
    else:
        status = "behind"

    return {
        "current_value":    round(current_value, 2),
        "target_value":     round(target_value, 2),
        "progress_pct":     round(progress_pct, 2),
        "status":           status,
        "gap":              round(gap, 2),
        "lower_is_better":  lower_is_better,
        "column_used":      column_used,
        "ai_recommendation": _recommendation(progress_pct, gap, goal_meta, lower_is_better),
    }
