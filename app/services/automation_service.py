"""Workflow Automation Engine Service.

Rule conditions are organised by industry so each business type sees only
the conditions that are relevant to their data.  The `get_conditions_for_industry`
helper returns the right subset; the `evaluate_rule` function handles them all.
"""
from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.dataframe_utils import safe_number

logger = logging.getLogger(__name__)


# ── Condition catalogue ────────────────────────────────────────────────────────
# Each entry: id, label, params list, icon, industries it applies to.
# "general" = shown for any/unknown industry.

_PARAM_PCT      = [{"key": "threshold_pct",   "label": "Threshold %",          "default": 15}]
_PARAM_PCT20    = [{"key": "threshold_pct",   "label": "Threshold %",          "default": 20}]
_PARAM_PCT30    = [{"key": "threshold_pct",   "label": "Threshold %",          "default": 30}]
_PARAM_DAYS     = [{"key": "threshold_days",  "label": "Max days",             "default": 45}]
_PARAM_SCORE    = [{"key": "threshold_score", "label": "Min Score (0–100)",    "default": 70}]
_PARAM_MISSING  = [{"key": "threshold_pct",   "label": "Max missing %",        "default": 10}]

_ALL_CONDITIONS = [
    # ── Universal ──────────────────────────────────────────────────────────────
    {"id": "missing_data_above",        "label": "Missing data exceeds X%",                          "params": _PARAM_MISSING, "icon": "❓",  "industries": ["general"]},
    {"id": "anomaly_detected",          "label": "Statistical anomaly detected in any column",       "params": [],             "icon": "⚠️", "industries": ["general"]},
    {"id": "data_quality_low",          "label": "Data quality score drops below X",                 "params": _PARAM_SCORE,   "icon": "📋",  "industries": ["general"]},

    # ── Retail & E-commerce ────────────────────────────────────────────────────
    {"id": "revenue_drop",              "label": "Revenue drops more than X%",                       "params": _PARAM_PCT,     "icon": "📉",  "industries": ["retail", "general", "travel", "finance"]},
    {"id": "revenue_spike",             "label": "Revenue spikes more than X%",                      "params": _PARAM_PCT20,   "icon": "📈",  "industries": ["retail", "general", "travel", "finance"]},
    {"id": "demand_increase",           "label": "Product demand increases more than X%",            "params": _PARAM_PCT20,   "icon": "🔼",  "industries": ["retail"]},
    {"id": "top_product_decline",       "label": "Top product revenue drops more than X%",           "params": _PARAM_PCT,     "icon": "📦",  "industries": ["retail"]},
    {"id": "salesperson_underperform",  "label": "Sales rep is X% below team average",               "params": _PARAM_PCT30,   "icon": "👤",  "industries": ["retail", "travel"]},
    {"id": "category_underperform",     "label": "Product category revenue X% below average",        "params": _PARAM_PCT30,   "icon": "🏷️", "industries": ["retail"]},

    # ── SaaS / Technology ──────────────────────────────────────────────────────
    {"id": "mrr_drop",                  "label": "MRR drops more than X%",                           "params": _PARAM_PCT,     "icon": "💸",  "industries": ["technology"]},
    {"id": "churn_spike",               "label": "Churn rate exceeds X%",                            "params": _PARAM_PCT20,   "icon": "🔄",  "industries": ["technology"]},
    {"id": "users_decline",             "label": "Active users drop more than X%",                   "params": _PARAM_PCT,     "icon": "👥",  "industries": ["technology"]},
    {"id": "arr_growth_below",          "label": "ARR growth is below X%",                           "params": [{"key": "threshold_pct", "label": "Min growth %", "default": 20}], "icon": "📊", "industries": ["technology"]},
    {"id": "cac_spike",                 "label": "Customer acquisition cost increases more than X%", "params": _PARAM_PCT20,   "icon": "💰",  "industries": ["technology"]},

    # ── HR & Workforce ─────────────────────────────────────────────────────────
    {"id": "turnover_spike",            "label": "Employee turnover rate exceeds X%",                "params": [{"key": "threshold_pct", "label": "Max turnover %", "default": 20}], "icon": "🚪", "industries": ["hr"]},
    {"id": "headcount_drop",            "label": "Headcount drops more than X%",                     "params": _PARAM_PCT,     "icon": "📉",  "industries": ["hr"]},
    {"id": "time_to_hire_long",         "label": "Average time-to-hire exceeds X days",              "params": _PARAM_DAYS,    "icon": "📅",  "industries": ["hr"]},
    {"id": "department_underperform",   "label": "Department headcount X% below average",            "params": _PARAM_PCT30,   "icon": "🏢",  "industries": ["hr"]},
    {"id": "salary_anomaly",            "label": "Salary values show statistical anomaly",           "params": [],             "icon": "💵",  "industries": ["hr"]},

    # ── Financial Services ─────────────────────────────────────────────────────
    {"id": "expense_spike",             "label": "Expenses increase more than X%",                   "params": _PARAM_PCT20,   "icon": "💳",  "industries": ["finance"]},
    {"id": "cost_income_high",          "label": "Cost-to-income ratio exceeds X%",                  "params": [{"key": "threshold_pct", "label": "Max ratio %", "default": 70}], "icon": "⚖️", "industries": ["finance"]},
    {"id": "transaction_anomaly",       "label": "Transaction amount anomaly detected",              "params": [],             "icon": "🏦",  "industries": ["finance"]},

    # ── Logistics & Supply Chain ───────────────────────────────────────────────
    {"id": "delivery_rate_drop",        "label": "On-time delivery rate drops below X%",             "params": [{"key": "threshold_pct", "label": "Min delivery %", "default": 85}], "icon": "🚚", "industries": ["logistics"]},
    {"id": "cost_per_shipment_spike",   "label": "Cost per shipment increases more than X%",         "params": _PARAM_PCT20,   "icon": "📦",  "industries": ["logistics"]},
    {"id": "shipment_volume_drop",      "label": "Shipment volume drops more than X%",               "params": _PARAM_PCT,     "icon": "📉",  "industries": ["logistics"]},
    {"id": "delay_spike",               "label": "Average delivery delay exceeds X days",            "params": _PARAM_DAYS,    "icon": "⏰",  "industries": ["logistics"]},

    # ── Manufacturing ──────────────────────────────────────────────────────────
    {"id": "defect_rate_high",          "label": "Defect rate exceeds X%",                           "params": [{"key": "threshold_pct", "label": "Max defect %", "default": 5}], "icon": "🔧", "industries": ["manufacturing"]},
    {"id": "production_drop",           "label": "Production output drops more than X%",             "params": _PARAM_PCT,     "icon": "🏭",  "industries": ["manufacturing"]},
    {"id": "oee_drop",                  "label": "Equipment effectiveness drops below X%",           "params": [{"key": "threshold_pct", "label": "Min OEE %", "default": 65}], "icon": "⚙️", "industries": ["manufacturing"]},
    {"id": "cost_per_unit_spike",       "label": "Production cost per unit increases more than X%",  "params": _PARAM_PCT20,   "icon": "💰",  "industries": ["manufacturing"]},

    # ── Travel & Hospitality ───────────────────────────────────────────────────
    {"id": "booking_rate_drop",         "label": "Booking confirmation rate drops below X%",         "params": [{"key": "threshold_pct", "label": "Min booking %", "default": 75}], "icon": "✈️", "industries": ["travel"]},
    {"id": "cancellation_spike",        "label": "Cancellation rate exceeds X%",                     "params": [{"key": "threshold_pct", "label": "Max cancel %", "default": 10}], "icon": "❌", "industries": ["travel"]},
    {"id": "booking_value_drop",        "label": "Average booking value drops more than X%",         "params": _PARAM_PCT,     "icon": "💰",  "industries": ["travel"]},
    {"id": "agent_underperform",        "label": "Agent is X% below team average in bookings",       "params": _PARAM_PCT30,   "icon": "🧑‍💼", "industries": ["travel"]},
]

# For backward compatibility — always available list (used by old clients)
AVAILABLE_CONDITIONS = _ALL_CONDITIONS

AVAILABLE_ACTIONS = [
    {"id": "create_notification",  "label": "Create in-app notification", "icon": "🔔"},
    {"id": "create_critical_alert","label": "Send critical alert",         "icon": "🚨"},
    {"id": "recommend_action",     "label": "Generate AI recommendation", "icon": "💡"},
    {"id": "flag_for_review",      "label": "Flag dataset for review",    "icon": "🚩"},
]


def get_conditions_for_industry(industry: str) -> list[dict]:
    """
    Return conditions relevant to the given industry.

    Always includes 'general' conditions (universal data quality checks).
    Industry-specific conditions are returned when the industry matches.
    Unknown/empty industry returns all conditions.
    """
    ind = (industry or "").lower().strip()
    if not ind or ind == "general":
        # Return everything for general / unknown
        return _ALL_CONDITIONS

    result = []
    for c in _ALL_CONDITIONS:
        industries = c.get("industries", [])
        if "general" in industries or ind in industries:
            result.append(c)
    return result if result else _ALL_CONDITIONS


# ── Column detection helpers ───────────────────────────────────────────────────

_REVENUE_SYNS  = ["revenue", "sales", "total_sales", "amount", "income", "value", "mrr", "arr"]
_QTY_SYNS      = ["quantity", "qty", "units", "volume", "orders", "bookings", "transactions"]
_PERSON_SYNS   = ["salesman", "salesperson", "sales_rep", "agent", "employee", "seller", "rep",
                   "staff", "worker", "associate"]
_CAT_SYNS      = ["product", "category", "item", "sku", "service", "line", "type"]
_DEPT_SYNS     = ["department", "dept", "division", "team", "group", "unit"]
_COST_SYNS     = ["cost", "expense", "freight", "shipping_cost", "spend", "cogs"]
_STATUS_SYNS   = ["status", "state", "outcome", "result", "flag", "type"]
_DAYS_SYNS     = ["days", "duration", "delay", "transit_days", "lead_time", "hire_days"]
_DEFECT_SYNS   = ["defect", "defects", "defect_rate", "defect_count", "scrap", "reject"]
_CHURN_SYNS    = ["churn", "churn_rate", "attrition", "turnover"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _half_trend(vals: pd.Series) -> float:
    """Compare second-half mean to first-half mean. Returns % change."""
    if len(vals) < 4:
        return 0.0
    mid = len(vals) // 2
    first  = vals.iloc[:mid].mean()
    second = vals.iloc[mid:].mean()
    if first == 0:
        return 0.0
    return float((second - first) / abs(first) * 100)


def _group_underperform(df: pd.DataFrame, group_col: str, metric_col: str,
                        threshold_pct: float) -> dict:
    """Generic 'entity X% below group average' evaluation."""
    grouped = df.groupby(group_col)[metric_col].apply(
        lambda s: s.apply(safe_number).dropna().sum()
    )
    if len(grouped) < 2:
        return {"triggered": False, "reason": f"Not enough {group_col} groups to compare"}
    avg  = grouped.mean()
    worst_name = str(grouped.idxmin())
    worst_val  = float(grouped.min())
    pct_below  = float((avg - worst_val) / avg * 100) if avg > 0 else 0.0
    if pct_below > threshold_pct:
        return {
            "triggered": True,
            "reason": f"'{worst_name}' is {pct_below:.1f}% below group average",
            "action_data": {"entity": worst_name, "pct_below": round(pct_below, 2), "column": group_col},
        }
    return {"triggered": False, "reason": f"All {group_col} groups within performance range"}


# ── Rule evaluator ─────────────────────────────────────────────────────────────

def evaluate_rule(rule: dict, df: pd.DataFrame) -> dict:  # noqa: C901
    """Evaluate one automation rule against the dataframe."""
    cond      = rule.get("condition_id", "")
    params    = rule.get("params", {})
    threshold = float(params.get("threshold_pct", params.get("threshold_score",
                      params.get("threshold_days", 15))))

    rev_col    = _find_col(df, _REVENUE_SYNS)
    qty_col    = _find_col(df, _QTY_SYNS)
    person_col = _find_col(df, _PERSON_SYNS)
    cat_col    = _find_col(df, _CAT_SYNS)
    dept_col   = _find_col(df, _DEPT_SYNS)
    cost_col   = _find_col(df, _COST_SYNS)
    status_col = _find_col(df, _STATUS_SYNS)
    days_col   = _find_col(df, _DAYS_SYNS)
    defect_col = _find_col(df, _DEFECT_SYNS)
    churn_col  = _find_col(df, _CHURN_SYNS)

    def _rev_trend() -> float | None:
        if not rev_col:
            return None
        return _half_trend(df[rev_col].apply(safe_number).dropna())

    # ── Universal ──────────────────────────────────────────────────────────────

    if cond == "missing_data_above":
        max_pct  = float(df.isnull().mean().max() * 100)
        worst    = str(df.isnull().mean().idxmax())
        if max_pct > threshold:
            return {"triggered": True,
                    "reason": f"'{worst}' has {max_pct:.1f}% missing data",
                    "action_data": {"column": worst, "missing_pct": round(max_pct, 2)}}
        return {"triggered": False, "reason": f"Missing data ({max_pct:.1f}%) within threshold"}

    if cond == "anomaly_detected":
        for col in df.select_dtypes(include="number").columns:
            vals = df[col].dropna()
            if len(vals) < 10:
                continue
            q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            outliers = vals[(vals < q1 - 3 * iqr) | (vals > q3 + 3 * iqr)]
            if len(outliers) / len(vals) > 0.05:
                return {"triggered": True,
                        "reason": f"{len(outliers)} outliers in '{col}' ({len(outliers)/len(vals)*100:.1f}%)",
                        "action_data": {"column": col, "outlier_count": int(len(outliers))}}
        return {"triggered": False, "reason": "No significant anomalies found"}

    if cond == "data_quality_low":
        from app.services.data_cleaning_service import analyze_data_quality
        result = analyze_data_quality(df)
        score  = result["quality_score"]
        if score < threshold:
            return {"triggered": True,
                    "reason": f"Data quality {score}/100 is below threshold {threshold}",
                    "action_data": {"quality_score": score}}
        return {"triggered": False, "reason": f"Data quality {score}/100 meets threshold"}

    # ── Revenue / sales ────────────────────────────────────────────────────────

    if cond == "revenue_drop":
        pct = _rev_trend()
        if pct is None:
            return {"triggered": False, "reason": "No revenue column detected"}
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"{rev_col} declined {abs(pct):.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": rev_col}}
        return {"triggered": False, "reason": f"{rev_col} change {pct:.1f}% within range"}

    if cond == "revenue_spike":
        pct = _rev_trend()
        if pct is None:
            return {"triggered": False, "reason": "No revenue column detected"}
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"{rev_col} spiked {pct:.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": rev_col}}
        return {"triggered": False, "reason": f"{rev_col} within normal range ({pct:.1f}%)"}

    if cond == "demand_increase":
        if not qty_col:
            return {"triggered": False, "reason": "No quantity/demand column detected"}
        pct = _half_trend(df[qty_col].apply(safe_number).dropna())
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Demand ({qty_col}) increased {pct:.1f}%",
                    "action_data": {"pct_change": round(pct, 2), "column": qty_col}}
        return {"triggered": False, "reason": f"Demand change {pct:.1f}% within range"}

    if cond == "top_product_decline":
        if not cat_col or not rev_col:
            return {"triggered": False, "reason": "No product/category or revenue column detected"}
        grouped = df.groupby(cat_col)[rev_col].apply(
            lambda s: s.apply(safe_number).dropna().sum()
        ).sort_values(ascending=False)
        if len(grouped) < 2:
            return {"triggered": False, "reason": "Not enough product categories"}
        top_name = str(grouped.index[0])
        # Compare first vs second half for the top product
        top_rows = df[df[cat_col].astype(str) == top_name]
        pct = _half_trend(top_rows[rev_col].apply(safe_number).dropna())
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Top product '{top_name}' revenue declined {abs(pct):.1f}%",
                    "action_data": {"product": top_name, "pct_change": round(pct, 2)}}
        return {"triggered": False, "reason": f"Top product '{top_name}' revenue change {pct:.1f}% — within range"}

    if cond == "salesperson_underperform":
        if not person_col or not rev_col:
            return {"triggered": False, "reason": "No salesperson or revenue column detected"}
        return _group_underperform(df, person_col, rev_col, threshold)

    if cond == "category_underperform":
        if not cat_col or not rev_col:
            return {"triggered": False, "reason": "No product/category or revenue column detected"}
        return _group_underperform(df, cat_col, rev_col, threshold)

    # ── SaaS / Technology ──────────────────────────────────────────────────────

    if cond == "mrr_drop":
        pct = _rev_trend()
        if pct is None:
            return {"triggered": False, "reason": "No MRR/revenue column detected"}
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"MRR/revenue declined {abs(pct):.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2)}}
        return {"triggered": False, "reason": f"MRR change {pct:.1f}% within range"}

    if cond == "churn_spike":
        if churn_col:
            vals = df[churn_col].apply(safe_number).dropna()
            pct  = float(vals.mean()) if not vals.empty else 0
            if pct > threshold:
                return {"triggered": True,
                        "reason": f"Churn rate {pct:.1f}% exceeds threshold {threshold}%",
                        "action_data": {"churn_rate": round(pct, 2), "column": churn_col}}
        # Fallback: high status = "churned" / "cancelled" rows
        if status_col:
            churn_kws = ["churned", "cancelled", "inactive", "lost", "closed"]
            total = len(df)
            churned = df[status_col].astype(str).str.lower().isin(churn_kws).sum()
            pct = churned / total * 100 if total > 0 else 0
            if pct > threshold:
                return {"triggered": True,
                        "reason": f"{pct:.1f}% of records show churned/inactive status",
                        "action_data": {"churn_rate": round(pct, 2)}}
        return {"triggered": False, "reason": "Churn within acceptable range"}

    if cond == "users_decline":
        # Active users — any column named 'users', 'active_users', 'mau', 'dau'
        user_col = _find_col(df, ["users", "active_users", "mau", "dau", "accounts", "seats"])
        if not user_col:
            return {"triggered": False, "reason": "No active users column detected"}
        pct = _half_trend(df[user_col].apply(safe_number).dropna())
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Active users ({user_col}) declined {abs(pct):.1f}%",
                    "action_data": {"pct_change": round(pct, 2), "column": user_col}}
        return {"triggered": False, "reason": f"User count change {pct:.1f}% within range"}

    if cond == "arr_growth_below":
        pct = _rev_trend()
        if pct is None:
            return {"triggered": False, "reason": "No ARR/revenue column detected"}
        if pct < threshold:
            return {"triggered": True,
                    "reason": f"ARR growth {pct:.1f}% is below target {threshold}%",
                    "action_data": {"growth_pct": round(pct, 2)}}
        return {"triggered": False, "reason": f"ARR growth {pct:.1f}% meets target"}

    if cond == "cac_spike":
        cac_col = _find_col(df, ["cac", "acquisition_cost", "cost_per_customer", "marketing_cost"])
        col_to_use = cac_col or cost_col
        if not col_to_use:
            return {"triggered": False, "reason": "No CAC/cost column detected"}
        pct = _half_trend(df[col_to_use].apply(safe_number).dropna())
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Acquisition cost increased {pct:.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": col_to_use}}
        return {"triggered": False, "reason": f"Acquisition cost change {pct:.1f}% within range"}

    # ── HR ─────────────────────────────────────────────────────────────────────

    if cond == "turnover_spike":
        if churn_col:
            pct = float(df[churn_col].apply(safe_number).dropna().mean()) if churn_col else 0
        elif status_col:
            left_kws = ["left", "resigned", "terminated", "inactive", "churned"]
            total = len(df)
            left  = df[status_col].astype(str).str.lower().isin(left_kws).sum()
            pct   = left / total * 100 if total > 0 else 0
        else:
            return {"triggered": False, "reason": "No turnover or status column detected"}
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Employee turnover rate {pct:.1f}% exceeds threshold {threshold}%",
                    "action_data": {"turnover_rate": round(pct, 2)}}
        return {"triggered": False, "reason": f"Turnover rate {pct:.1f}% within range"}

    if cond == "headcount_drop":
        hc_col = _find_col(df, ["headcount", "employees", "staff", "fte", "workforce"])
        col_to_use = hc_col or (dept_col if dept_col else None)
        if not col_to_use:
            # Use row count as headcount proxy if each row is an employee
            rows_first = len(df) // 2
            rows_all   = len(df)
            pct = ((rows_first - rows_all) / rows_first * 100) if rows_first > 0 else 0
            if abs(pct) > threshold:
                return {"triggered": True,
                        "reason": f"Dataset size (employee count proxy) changed {pct:.1f}%",
                        "action_data": {"pct_change": round(pct, 2)}}
            return {"triggered": False, "reason": "Headcount appears stable"}
        pct = _half_trend(df[col_to_use].apply(safe_number).dropna())
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Headcount dropped {abs(pct):.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": col_to_use}}
        return {"triggered": False, "reason": f"Headcount change {pct:.1f}% within range"}

    if cond == "time_to_hire_long":
        col_to_use = days_col or _find_col(df, ["hire_days", "days_to_hire", "recruitment_days"])
        if not col_to_use:
            return {"triggered": False, "reason": "No time-to-hire column detected"}
        avg_days = float(df[col_to_use].apply(safe_number).dropna().mean())
        if avg_days > threshold:
            return {"triggered": True,
                    "reason": f"Average time-to-hire {avg_days:.1f} days exceeds {threshold} days",
                    "action_data": {"avg_days": round(avg_days, 1), "column": col_to_use}}
        return {"triggered": False, "reason": f"Average time-to-hire {avg_days:.1f} days — within target"}

    if cond == "department_underperform":
        dept = dept_col or _find_col(df, ["team", "group", "division"])
        metric = _find_col(df, ["headcount", "employees", "salary", "performance"]) or rev_col
        if not dept or not metric:
            return {"triggered": False, "reason": "No department or metric column detected"}
        return _group_underperform(df, dept, metric, threshold)

    if cond == "salary_anomaly":
        sal_col = _find_col(df, ["salary", "wage", "compensation", "pay"])
        if not sal_col:
            return {"triggered": False, "reason": "No salary column detected"}
        vals = df[sal_col].apply(safe_number).dropna()
        if len(vals) < 5:
            return {"triggered": False, "reason": "Not enough salary records"}
        q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
        iqr = q3 - q1
        outliers = vals[(vals < q1 - 3 * iqr) | (vals > q3 + 3 * iqr)]
        if len(outliers) > 0:
            return {"triggered": True,
                    "reason": f"{len(outliers)} salary outliers detected in '{sal_col}'",
                    "action_data": {"outlier_count": int(len(outliers)), "column": sal_col}}
        return {"triggered": False, "reason": "No salary anomalies detected"}

    # ── Finance ────────────────────────────────────────────────────────────────

    if cond == "expense_spike":
        if not cost_col:
            return {"triggered": False, "reason": "No expense/cost column detected"}
        pct = _half_trend(df[cost_col].apply(safe_number).dropna())
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Expenses ({cost_col}) increased {pct:.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": cost_col}}
        return {"triggered": False, "reason": f"Expense change {pct:.1f}% within range"}

    if cond == "cost_income_high":
        if not cost_col or not rev_col:
            return {"triggered": False, "reason": "No cost and income columns detected"}
        cost_total = float(df[cost_col].apply(safe_number).dropna().sum())
        rev_total  = float(df[rev_col].apply(safe_number).dropna().sum())
        if rev_total == 0:
            return {"triggered": False, "reason": "Income total is zero"}
        ratio = cost_total / rev_total * 100
        if ratio > threshold:
            return {"triggered": True,
                    "reason": f"Cost-to-income ratio {ratio:.1f}% exceeds threshold {threshold}%",
                    "action_data": {"ratio": round(ratio, 2)}}
        return {"triggered": False, "reason": f"Cost-to-income ratio {ratio:.1f}% within range"}

    if cond == "transaction_anomaly":
        tx_col = _find_col(df, ["transaction", "amount", "payment", "transfer"]) or rev_col
        if not tx_col:
            return {"triggered": False, "reason": "No transaction amount column detected"}
        vals = df[tx_col].apply(safe_number).dropna()
        if len(vals) < 10:
            return {"triggered": False, "reason": "Not enough transactions"}
        q1, q3 = vals.quantile(0.25), vals.quantile(0.75)
        iqr = q3 - q1
        outliers = vals[(vals < q1 - 3 * iqr) | (vals > q3 + 3 * iqr)]
        if len(outliers) / len(vals) > 0.05:
            return {"triggered": True,
                    "reason": f"{len(outliers)} anomalous transactions detected in '{tx_col}'",
                    "action_data": {"outlier_count": int(len(outliers)), "column": tx_col}}
        return {"triggered": False, "reason": "No transaction anomalies detected"}

    # ── Logistics ──────────────────────────────────────────────────────────────

    if cond == "delivery_rate_drop":
        if status_col:
            delivered_kws = ["delivered", "on_time", "completed", "success"]
            total     = len(df)
            delivered = df[status_col].astype(str).str.lower().isin(delivered_kws).sum()
            pct       = delivered / total * 100 if total > 0 else 0
            if pct < threshold:
                return {"triggered": True,
                        "reason": f"On-time delivery rate {pct:.1f}% below target {threshold}%",
                        "action_data": {"delivery_rate": round(pct, 2)}}
            return {"triggered": False, "reason": f"Delivery rate {pct:.1f}% meets target"}
        return {"triggered": False, "reason": "No delivery status column detected"}

    if cond == "cost_per_shipment_spike":
        if not cost_col:
            return {"triggered": False, "reason": "No shipment cost column detected"}
        pct = _half_trend(df[cost_col].apply(safe_number).dropna())
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Cost per shipment increased {pct:.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": cost_col}}
        return {"triggered": False, "reason": f"Shipment cost change {pct:.1f}% within range"}

    if cond == "shipment_volume_drop":
        vol_col = qty_col or _find_col(df, ["shipments", "packages", "parcels"])
        if not vol_col:
            return {"triggered": False, "reason": "No shipment volume column detected"}
        pct = _half_trend(df[vol_col].apply(safe_number).dropna())
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Shipment volume dropped {abs(pct):.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": vol_col}}
        return {"triggered": False, "reason": f"Shipment volume change {pct:.1f}% within range"}

    if cond == "delay_spike":
        col_to_use = days_col or _find_col(df, ["delay", "delay_days", "transit_days"])
        if not col_to_use:
            return {"triggered": False, "reason": "No delay/transit days column detected"}
        avg_days = float(df[col_to_use].apply(safe_number).dropna().mean())
        if avg_days > threshold:
            return {"triggered": True,
                    "reason": f"Average delay {avg_days:.1f} days exceeds threshold {threshold} days",
                    "action_data": {"avg_days": round(avg_days, 1), "column": col_to_use}}
        return {"triggered": False, "reason": f"Average delay {avg_days:.1f} days within target"}

    # ── Manufacturing ──────────────────────────────────────────────────────────

    if cond == "defect_rate_high":
        if defect_col:
            vals = df[defect_col].apply(safe_number).dropna()
            rate = float(vals.mean()) if not vals.empty else 0
        elif status_col:
            defect_kws = ["defect", "reject", "fail", "failed", "scrap"]
            total  = len(df)
            bad    = df[status_col].astype(str).str.lower().isin(defect_kws).sum()
            rate   = bad / total * 100 if total > 0 else 0
        else:
            return {"triggered": False, "reason": "No defect rate or status column detected"}
        if rate > threshold:
            return {"triggered": True,
                    "reason": f"Defect rate {rate:.1f}% exceeds threshold {threshold}%",
                    "action_data": {"defect_rate": round(rate, 2)}}
        return {"triggered": False, "reason": f"Defect rate {rate:.1f}% within acceptable range"}

    if cond == "production_drop":
        prod_col = qty_col or _find_col(df, ["production", "units_produced", "output"])
        if not prod_col:
            return {"triggered": False, "reason": "No production output column detected"}
        pct = _half_trend(df[prod_col].apply(safe_number).dropna())
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Production output dropped {abs(pct):.1f}% (threshold: {threshold}%)",
                    "action_data": {"pct_change": round(pct, 2), "column": prod_col}}
        return {"triggered": False, "reason": f"Production change {pct:.1f}% within range"}

    if cond == "oee_drop":
        oee_col = _find_col(df, ["oee", "effectiveness", "efficiency", "availability"])
        if not oee_col:
            return {"triggered": False, "reason": "No OEE/efficiency column detected"}
        avg_oee = float(df[oee_col].apply(safe_number).dropna().mean())
        if avg_oee < threshold:
            return {"triggered": True,
                    "reason": f"Average OEE {avg_oee:.1f}% is below target {threshold}%",
                    "action_data": {"avg_oee": round(avg_oee, 1), "column": oee_col}}
        return {"triggered": False, "reason": f"Average OEE {avg_oee:.1f}% meets target"}

    if cond == "cost_per_unit_spike":
        unit_cost_col = _find_col(df, ["cost_per_unit", "unit_cost", "production_cost"])
        col_to_use = unit_cost_col or cost_col
        if not col_to_use:
            return {"triggered": False, "reason": "No unit cost column detected"}
        pct = _half_trend(df[col_to_use].apply(safe_number).dropna())
        if pct > threshold:
            return {"triggered": True,
                    "reason": f"Production cost per unit increased {pct:.1f}%",
                    "action_data": {"pct_change": round(pct, 2), "column": col_to_use}}
        return {"triggered": False, "reason": f"Unit cost change {pct:.1f}% within range"}

    # ── Travel & Hospitality ───────────────────────────────────────────────────

    if cond == "booking_rate_drop":
        if status_col:
            booked_kws = ["confirmed", "booked", "completed", "reserved"]
            total  = len(df)
            booked = df[status_col].astype(str).str.lower().isin(booked_kws).sum()
            rate   = booked / total * 100 if total > 0 else 0
            if rate < threshold:
                return {"triggered": True,
                        "reason": f"Booking confirmation rate {rate:.1f}% below target {threshold}%",
                        "action_data": {"booking_rate": round(rate, 2)}}
            return {"triggered": False, "reason": f"Booking rate {rate:.1f}% meets target"}
        return {"triggered": False, "reason": "No booking status column detected"}

    if cond == "cancellation_spike":
        if status_col:
            cancel_kws = ["cancelled", "canceled", "voided", "refunded"]
            total    = len(df)
            canceled = df[status_col].astype(str).str.lower().isin(cancel_kws).sum()
            rate     = canceled / total * 100 if total > 0 else 0
            if rate > threshold:
                return {"triggered": True,
                        "reason": f"Cancellation rate {rate:.1f}% exceeds threshold {threshold}%",
                        "action_data": {"cancellation_rate": round(rate, 2)}}
            return {"triggered": False, "reason": f"Cancellation rate {rate:.1f}% within range"}
        return {"triggered": False, "reason": "No booking status column detected"}

    if cond == "booking_value_drop":
        pct = _rev_trend()
        if pct is None:
            return {"triggered": False, "reason": "No booking value/revenue column detected"}
        if pct < -threshold:
            return {"triggered": True,
                    "reason": f"Average booking value dropped {abs(pct):.1f}%",
                    "action_data": {"pct_change": round(pct, 2)}}
        return {"triggered": False, "reason": f"Booking value change {pct:.1f}% within range"}

    if cond == "agent_underperform":
        ag_col = person_col or _find_col(df, ["agent", "advisor", "consultant", "broker"])
        bk_col = qty_col or rev_col
        if not ag_col or not bk_col:
            return {"triggered": False, "reason": "No agent or bookings column detected"}
        return _group_underperform(df, ag_col, bk_col, threshold)

    return {"triggered": False, "reason": f"Unknown condition: {cond}"}


def run_automations(rules: list[dict], df: pd.DataFrame) -> list[dict]:
    """Evaluate all active rules and return triggered results."""
    results = []
    for rule in rules:
        if not rule.get("active", True):
            continue
        try:
            eval_result = evaluate_rule(rule, df)
            results.append({
                "rule_id":      rule.get("rule_id"),
                "rule_name":    rule.get("name", "Unnamed Rule"),
                "condition_id": rule.get("condition_id"),
                "action_id":    rule.get("action_id"),
                "triggered":    eval_result["triggered"],
                "reason":       eval_result["reason"],
                "action_data":  eval_result.get("action_data", {}),
            })
        except Exception as exc:
            logger.exception("Rule evaluation failed for %s", rule.get("rule_id"))
            results.append({
                "rule_id":   rule.get("rule_id"),
                "rule_name": rule.get("name", "Unnamed Rule"),
                "triggered": False,
                "reason":    f"Evaluation error: {exc}",
            })
    return results
