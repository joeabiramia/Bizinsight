"""Scenario Simulation Service ("What-If" Engine).

Simulates the impact of business variable changes using elasticity-based modeling
derived from the actual dataset.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_PRICE_SYNS = ["price", "unit_price", "cost", "fee", "rate", "tariff"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders", "bookings"]
_MARKETING_SYNS = ["marketing", "advertising", "ad_spend", "campaign", "promotion"]
_STAFF_SYNS = ["staff", "headcount", "employees", "sales_staff", "agents"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _estimate_price_elasticity(df: pd.DataFrame, price_col: str, rev_col: str) -> float:
    """Estimate price elasticity using log-log regression."""
    try:
        prices = df[price_col].apply(safe_number).dropna()
        revenues = df[rev_col].apply(safe_number).dropna()
        common_idx = prices.index.intersection(revenues.index)
        p = prices.loc[common_idx]
        r = revenues.loc[common_idx]
        mask = (p > 0) & (r > 0)
        if mask.sum() < 5:
            return -1.2  # default inelastic
        log_p = np.log(p[mask].values).reshape(-1, 1)
        log_r = np.log(r[mask].values)
        model = LinearRegression()
        model.fit(log_p, log_r)
        return float(model.coef_[0])
    except Exception:
        return -1.2


def simulate_scenario(df: pd.DataFrame, scenario: dict) -> dict:
    """
    Simulate business scenario impact.

    scenario keys:
      - price_change_pct: float (e.g., 10 means +10%)
      - volume_change_pct: float
      - marketing_change_pct: float
      - staff_change_pct: float
      - cost_change_pct: float
    """
    rev_col = _find_col(df, _REVENUE_SYNS)
    price_col = _find_col(df, _PRICE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    mkt_col = _find_col(df, _MARKETING_SYNS)

    # Base values
    base_revenue = float(df[rev_col].apply(safe_number).dropna().sum()) if rev_col else 0
    base_qty = float(df[qty_col].apply(safe_number).dropna().sum()) if qty_col else 0

    results: dict[str, dict] = {}
    total_revenue_impact_pct = 0.0
    explanations: list[str] = []

    # ── Price change ─────────────────────────────────────────────────────────
    price_change = float(scenario.get("price_change_pct", 0))
    if price_change != 0 and rev_col:
        if price_col:
            elasticity = _estimate_price_elasticity(df, price_col, rev_col)
        else:
            elasticity = -1.2  # default assumption

        # Revenue impact = price_change% + elasticity * price_change% (demand effect)
        demand_change_pct = elasticity * price_change
        revenue_impact_pct = price_change + demand_change_pct
        total_revenue_impact_pct += revenue_impact_pct

        results["price"] = {
            "change_pct": price_change,
            "elasticity": round(elasticity, 3),
            "demand_change_pct": round(demand_change_pct, 2),
            "revenue_impact_pct": round(revenue_impact_pct, 2),
            "new_estimated_revenue": round(base_revenue * (1 + revenue_impact_pct / 100), 2),
        }
        direction = "increase" if price_change > 0 else "decrease"
        explanations.append(
            f"A {abs(price_change):.1f}% price {direction} is estimated to {direction if revenue_impact_pct > 0 else 'decrease'} "
            f"revenue by {abs(revenue_impact_pct):.1f}% "
            f"(accounting for estimated demand elasticity of {elasticity:.2f})."
        )

    # ── Volume / demand change ────────────────────────────────────────────────
    volume_change = float(scenario.get("volume_change_pct", 0))
    if volume_change != 0 and rev_col:
        revenue_impact_pct = volume_change  # direct proportional impact
        total_revenue_impact_pct += revenue_impact_pct
        results["volume"] = {
            "change_pct": volume_change,
            "revenue_impact_pct": round(revenue_impact_pct, 2),
            "new_estimated_revenue": round(base_revenue * (1 + revenue_impact_pct / 100), 2),
            "new_estimated_qty": round(base_qty * (1 + volume_change / 100), 2),
        }
        direction = "increase" if volume_change > 0 else "decrease"
        explanations.append(
            f"A {abs(volume_change):.1f}% volume {direction} would directly "
            f"{'boost' if volume_change > 0 else 'reduce'} revenue by {abs(revenue_impact_pct):.1f}%."
        )

    # ── Marketing spend change ────────────────────────────────────────────────
    marketing_change = float(scenario.get("marketing_change_pct", 0))
    if marketing_change != 0 and rev_col:
        # Typical marketing ROI: every 10% spend increase → ~3-5% revenue increase
        marketing_roi_multiplier = 0.35 if mkt_col else 0.30
        revenue_impact_pct = marketing_change * marketing_roi_multiplier
        total_revenue_impact_pct += revenue_impact_pct
        results["marketing"] = {
            "change_pct": marketing_change,
            "estimated_roi_multiplier": marketing_roi_multiplier,
            "revenue_impact_pct": round(revenue_impact_pct, 2),
            "new_estimated_revenue": round(base_revenue * (1 + revenue_impact_pct / 100), 2),
        }
        direction = "increase" if marketing_change > 0 else "decrease"
        explanations.append(
            f"A {abs(marketing_change):.1f}% marketing spend {direction} is projected to "
            f"{'boost' if marketing_change > 0 else 'reduce'} revenue by ~{abs(revenue_impact_pct):.1f}%."
        )

    # ── Staff headcount change ────────────────────────────────────────────────
    staff_change = float(scenario.get("staff_change_pct", 0))
    if staff_change != 0 and rev_col:
        # Each 10% staff increase → ~4% revenue increase (diminishing returns)
        staff_multiplier = 0.4
        revenue_impact_pct = staff_change * staff_multiplier
        total_revenue_impact_pct += revenue_impact_pct
        results["staff"] = {
            "change_pct": staff_change,
            "revenue_impact_pct": round(revenue_impact_pct, 2),
            "new_estimated_revenue": round(base_revenue * (1 + revenue_impact_pct / 100), 2),
        }
        direction = "increase" if staff_change > 0 else "decrease"
        explanations.append(
            f"A {abs(staff_change):.1f}% staff {direction} could "
            f"{'improve' if staff_change > 0 else 'reduce'} revenue by ~{abs(revenue_impact_pct):.1f}%."
        )

    # ── Cost reduction (margin impact) ───────────────────────────────────────
    cost_change = float(scenario.get("cost_change_pct", 0))
    if cost_change != 0:
        # Direct profit impact (assumed 40% cost ratio)
        cost_ratio = 0.4
        profit_impact_pct = -cost_change * cost_ratio
        results["cost"] = {
            "change_pct": cost_change,
            "assumed_cost_ratio": cost_ratio,
            "profit_impact_pct": round(profit_impact_pct, 2),
            "estimated_profit_uplift": round(base_revenue * cost_ratio * (-cost_change / 100), 2),
        }
        direction = "reduction" if cost_change < 0 else "increase"
        direction_word = "save" if cost_change < 0 else "cost"
        explanations.append(
            f"A {abs(cost_change):.1f}% cost {direction} would "
            f"{direction_word} approximately ${abs(results['cost']['estimated_profit_uplift']):,.0f} "
            f"in estimated profit impact."
        )

    # Combined projection
    projected_revenue = base_revenue * (1 + total_revenue_impact_pct / 100)
    revenue_delta = projected_revenue - base_revenue

    # Compute base health scores, then project them from scenario impact
    try:
        from app.services.health_score_service import calculate_health_scores
        base_health = calculate_health_scores(df)
        projected_health = _project_health_scores(base_health, scenario, total_revenue_impact_pct)
    except Exception:
        base_health = None
        projected_health = None

    return {
        "base_revenue": round(base_revenue, 2),
        "projected_revenue": round(projected_revenue, 2),
        "revenue_delta": round(revenue_delta, 2),
        "total_revenue_impact_pct": round(total_revenue_impact_pct, 2),
        "scenario_results": results,
        "explanations": explanations,
        "summary": (
            f"Under this scenario, projected revenue is ${projected_revenue:,.2f} "
            f"({'+'if revenue_delta >= 0 else ''}{revenue_delta:,.2f}, "
            f"{total_revenue_impact_pct:+.1f}% from current baseline of ${base_revenue:,.2f})."
        ),
        "confidence": "medium" if len(results) >= 2 else "low",
        "disclaimer": "Projections are estimates based on statistical patterns in your data. Actual results may vary.",
        "base_health": base_health,
        "projected_health": projected_health,
    }


def _project_health_scores(base_health: dict, scenario: dict, total_revenue_impact_pct: float) -> dict:
    """
    Derive projected health scores analytically from the simulation outputs.

    Rather than re-running the scorer on a synthetic DataFrame, we apply
    scenario-specific deltas to each health dimension so the result is
    directly explainable in terms of what the user changed.
    """
    price_change     = float(scenario.get("price_change_pct", 0))
    volume_change    = float(scenario.get("volume_change_pct", 0))
    marketing_change = float(scenario.get("marketing_change_pct", 0))
    staff_change     = float(scenario.get("staff_change_pct", 0))
    cost_change      = float(scenario.get("cost_change_pct", 0))

    base_overall    = base_health["overall"]["score"]
    base_stability  = base_health["revenue_stability"]["score"]
    base_growth     = base_health["growth"]["score"]
    base_risk       = base_health["risk"]["score"]

    # ── Growth: revenue impact is the primary driver ───────────────────────────
    growth_delta = total_revenue_impact_pct * 1.5
    projected_growth = max(0.0, min(100.0, base_growth + growth_delta))

    # ── Stability: volume / marketing help; cost spikes and staff cuts hurt ────
    stability_delta = volume_change * 0.10 + marketing_change * 0.05
    if staff_change < 0:
        stability_delta += staff_change * 0.10   # negative * 0.10 → negative delta
    if cost_change > 0:
        stability_delta -= cost_change * 0.10    # rising costs hurt stability
    projected_stability = max(0.0, min(100.0, base_stability + stability_delta))

    # ── Risk: cost reduction is the clearest risk reducer ─────────────────────
    risk_delta = -cost_change * 0.30             # cut costs → lower risk; raise costs → higher risk
    if staff_change < 0:
        risk_delta += staff_change * 0.15        # headcount cuts add operational risk
    if marketing_change > 0:
        risk_delta += marketing_change * 0.03    # growth investment = small positive
    projected_risk = max(0.0, min(100.0, base_risk + risk_delta))

    # ── Overall: same weights as calculate_health_scores ──────────────────────
    projected_overall = round(
        projected_stability * 0.35 + projected_growth * 0.35 + projected_risk * 0.30, 1
    )

    def _grade(s: float) -> str:
        if s >= 80: return "A"
        if s >= 65: return "B"
        if s >= 50: return "C"
        if s >= 35: return "D"
        return "F"

    def _color(s: float) -> str:
        if s >= 75: return "green"
        if s >= 50: return "yellow"
        return "red"

    def _dim(label: str, score: float, base_score: float, explanation: str) -> dict:
        return {
            "score": round(score, 1),
            "grade": _grade(score),
            "color": _color(score),
            "label": label,
            "explanation": explanation,
            "delta": round(score - base_score, 1),
        }

    rev_sign = "+" if total_revenue_impact_pct >= 0 else ""
    return {
        "overall": _dim(
            "Overall Health (Projected)", projected_overall, base_overall,
            f"Projected composite score under this scenario "
            f"(revenue impact: {rev_sign}{total_revenue_impact_pct:.1f}%).",
        ),
        "revenue_stability": _dim(
            "Revenue Stability (Projected)", projected_stability, base_stability,
            "Reflects how volume, cost, and staffing changes affect revenue consistency.",
        ),
        "growth": _dim(
            "Growth Score (Projected)", projected_growth, base_growth,
            f"Driven by the estimated revenue change of {rev_sign}{total_revenue_impact_pct:.1f}%.",
        ),
        "risk": _dim(
            "Risk Score (Projected)", projected_risk, base_risk,
            "Reflects cost structure and operational risk changes under this scenario.",
        ),
    }
