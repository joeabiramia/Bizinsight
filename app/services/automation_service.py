"""Workflow Automation Engine Service.

Rule-based automation for triggering alerts and actions based on data conditions.
"""
from __future__ import annotations

import logging
from typing import Any

import pandas as pd

from app.dataframe_utils import safe_number

logger = logging.getLogger(__name__)

AVAILABLE_CONDITIONS = [
    {"id": "revenue_drop", "label": "Revenue drops more than X%", "params": [{"key": "threshold_pct", "label": "Threshold %", "default": 15}], "icon": "📉"},
    {"id": "revenue_spike", "label": "Revenue spikes more than X%", "params": [{"key": "threshold_pct", "label": "Threshold %", "default": 20}], "icon": "📈"},
    {"id": "demand_increase", "label": "Product demand increases more than X%", "params": [{"key": "threshold_pct", "label": "Threshold %", "default": 20}], "icon": "🔼"},
    {"id": "salesperson_underperform", "label": "Salesperson is X% below team average", "params": [{"key": "threshold_pct", "label": "% Below Average", "default": 30}], "icon": "👤"},
    {"id": "missing_data_above", "label": "Missing data exceeds X%", "params": [{"key": "threshold_pct", "label": "Threshold %", "default": 10}], "icon": "❓"},
    {"id": "anomaly_detected", "label": "Statistical anomaly detected in data", "params": [], "icon": "⚠️"},
    {"id": "data_quality_low", "label": "Data quality score drops below X", "params": [{"key": "threshold_score", "label": "Min Score (0-100)", "default": 70}], "icon": "📋"},
]

AVAILABLE_ACTIONS = [
    {"id": "create_notification", "label": "Create smart notification", "icon": "🔔"},
    {"id": "create_critical_alert", "label": "Send critical alert", "icon": "🚨"},
    {"id": "recommend_action", "label": "Generate AI recommendation", "icon": "💡"},
    {"id": "flag_for_review", "label": "Flag dataset for review", "icon": "🚩"},
]

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders", "bookings"]
_SALESMAN_SYNS = ["salesman", "salesperson", "sales_rep", "agent", "employee", "seller", "rep"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _half_trend(vals: pd.Series) -> float:
    """Compare second half mean to first half mean. Returns % change."""
    if len(vals) < 4:
        return 0.0
    mid = len(vals) // 2
    first = vals.iloc[:mid].mean()
    second = vals.iloc[mid:].mean()
    if first == 0:
        return 0.0
    return float((second - first) / abs(first) * 100)


def evaluate_rule(rule: dict, df: pd.DataFrame) -> dict:
    """Evaluate one automation rule against the dataframe."""
    cond = rule.get("condition_id", "")
    params = rule.get("params", {})
    threshold = float(params.get("threshold_pct", params.get("threshold_score", 10)))

    rev_col = _find_col(df, _REVENUE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    salesman_col = _find_col(df, _SALESMAN_SYNS)

    if cond == "revenue_drop":
        if not rev_col:
            return {"triggered": False, "reason": "No revenue column detected"}
        vals = df[rev_col].apply(safe_number).dropna()
        pct = _half_trend(vals)
        if pct < -threshold:
            return {
                "triggered": True,
                "reason": f"Revenue declined {abs(pct):.1f}% (threshold: {threshold}%)",
                "action_data": {"pct_change": round(pct, 2), "column": rev_col},
            }
        return {"triggered": False, "reason": f"Revenue change {pct:.1f}% within threshold"}

    if cond == "revenue_spike":
        if not rev_col:
            return {"triggered": False, "reason": "No revenue column detected"}
        vals = df[rev_col].apply(safe_number).dropna()
        pct = _half_trend(vals)
        if pct > threshold:
            return {
                "triggered": True,
                "reason": f"Revenue spiked {pct:.1f}% (threshold: {threshold}%)",
                "action_data": {"pct_change": round(pct, 2), "column": rev_col},
            }
        return {"triggered": False, "reason": f"Revenue within normal range ({pct:.1f}%)"}

    if cond == "demand_increase":
        if not qty_col:
            return {"triggered": False, "reason": "No quantity/demand column detected"}
        vals = df[qty_col].apply(safe_number).dropna()
        pct = _half_trend(vals)
        if pct > threshold:
            return {
                "triggered": True,
                "reason": f"Demand increased {pct:.1f}% (threshold: {threshold}%)",
                "action_data": {"pct_change": round(pct, 2), "column": qty_col},
            }
        return {"triggered": False, "reason": f"Demand change {pct:.1f}% within normal range"}

    if cond == "salesperson_underperform":
        if not salesman_col or not rev_col:
            return {"triggered": False, "reason": "Salesperson or revenue column not found"}
        grouped = df.groupby(salesman_col)[rev_col].apply(
            lambda s: s.apply(safe_number).dropna().sum()
        )
        if len(grouped) < 2:
            return {"triggered": False, "reason": "Not enough salespeople to compare"}
        avg = grouped.mean()
        worst_name = str(grouped.idxmin())
        worst_val = float(grouped.min())
        pct_below = float((avg - worst_val) / avg * 100) if avg > 0 else 0.0
        if pct_below > threshold:
            return {
                "triggered": True,
                "reason": f"'{worst_name}' is {pct_below:.1f}% below team average",
                "action_data": {"salesperson": worst_name, "pct_below": round(pct_below, 2)},
            }
        return {"triggered": False, "reason": "All salespeople within performance range"}

    if cond == "missing_data_above":
        max_missing_pct = float(df.isnull().mean().max() * 100)
        worst_col = str(df.isnull().mean().idxmax())
        if max_missing_pct > threshold:
            return {
                "triggered": True,
                "reason": f"'{worst_col}' has {max_missing_pct:.1f}% missing data",
                "action_data": {"column": worst_col, "missing_pct": round(max_missing_pct, 2)},
            }
        return {"triggered": False, "reason": f"Missing data ({max_missing_pct:.1f}%) within threshold"}

    if cond == "anomaly_detected":
        for col in df.select_dtypes(include="number").columns:
            vals = df[col].dropna()
            if len(vals) < 10:
                continue
            q1 = vals.quantile(0.25)
            q3 = vals.quantile(0.75)
            iqr = q3 - q1
            if iqr == 0:
                continue
            outliers = vals[(vals < q1 - 3 * iqr) | (vals > q3 + 3 * iqr)]
            if len(outliers) / len(vals) > 0.05:
                return {
                    "triggered": True,
                    "reason": f"{len(outliers)} outliers in '{col}' ({len(outliers)/len(vals)*100:.1f}% of values)",
                    "action_data": {"column": col, "outlier_count": int(len(outliers))},
                }
        return {"triggered": False, "reason": "No significant anomalies found"}

    if cond == "data_quality_low":
        from app.services.data_cleaning_service import analyze_data_quality
        result = analyze_data_quality(df)
        score = result["quality_score"]
        if score < threshold:
            return {
                "triggered": True,
                "reason": f"Data quality score {score}/100 is below threshold {threshold}",
                "action_data": {"quality_score": score},
            }
        return {"triggered": False, "reason": f"Data quality score {score}/100 meets threshold"}

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
                "rule_id": rule.get("rule_id"),
                "rule_name": rule.get("name", "Unnamed Rule"),
                "condition_id": rule.get("condition_id"),
                "action_id": rule.get("action_id"),
                "triggered": eval_result["triggered"],
                "reason": eval_result["reason"],
                "action_data": eval_result.get("action_data", {}),
            })
        except Exception as exc:
            logger.exception("Rule evaluation failed for %s", rule.get("rule_id"))
            results.append({
                "rule_id": rule.get("rule_id"),
                "rule_name": rule.get("name", "Unnamed Rule"),
                "triggered": False,
                "reason": f"Evaluation error: {exc}",
            })
    return results
