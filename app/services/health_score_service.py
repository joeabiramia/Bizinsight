"""Business Health Scoring Service.

Computes composite scores (0-100) for:
  - Overall Health
  - Revenue Stability
  - Growth
  - Risk
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_DATE_SYNS = ["date", "month", "week", "year", "period", "time", "created"]


def _normalize_col(name: str) -> str:
    return str(name).lower().replace(" ", "_").replace("-", "_")


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = _normalize_col(col).split("_")
            if syn in parts or _normalize_col(col) == syn:
                return col
    return None


def _numeric_series(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col].apply(safe_number).dropna()


def _revenue_stability_score(df: pd.DataFrame, rev_col: str | None) -> tuple[float, str]:
    """Coefficient of Variation → lower CV = higher stability."""
    if not rev_col:
        return 50.0, "No revenue column detected; defaulting to neutral score."
    vals = _numeric_series(df, rev_col)
    if vals.empty or vals.mean() == 0:
        return 40.0, "Revenue data could not be evaluated."
    cv = vals.std() / abs(vals.mean())
    # CV < 0.1 → 100, CV > 1.0 → 0
    score = max(0.0, min(100.0, 100 - (cv * 100)))
    label = "Very Stable" if score >= 80 else "Stable" if score >= 60 else "Moderate" if score >= 40 else "Volatile"
    return round(score, 1), f"Revenue coefficient of variation is {cv:.2f} — {label}."


def _growth_score(df: pd.DataFrame, rev_col: str | None, date_col: str | None) -> tuple[float, str]:
    """Monthly trend slope normalized to a 0–100 score."""
    if not rev_col:
        return 50.0, "No revenue column detected."
    vals = _numeric_series(df, rev_col)
    if vals.empty:
        return 50.0, "Insufficient data for growth analysis."

    if date_col:
        try:
            temp = pd.DataFrame({"_rev": df[rev_col].apply(safe_number), "_date": pd.to_datetime(df[date_col], errors="coerce")})
            temp = temp.dropna()
            temp["_month"] = temp["_date"].dt.to_period("M")
            monthly = temp.groupby("_month")["_rev"].sum().sort_index()
            if len(monthly) >= 3:
                x = np.arange(len(monthly))
                y = monthly.values.astype(float)
                slope = np.polyfit(x, y, 1)[0]
                mean_val = y.mean() if y.mean() != 0 else 1
                normalized = slope / mean_val
                score = max(0.0, min(100.0, 50 + normalized * 200))
                direction = "growing" if slope > 0 else "declining"
                pct = abs(normalized) * 100
                return round(score, 1), f"Revenue is {direction} at {pct:.1f}% per period on average."
        except Exception:
            pass

    # Fallback: compare first half vs second half
    half = len(vals) // 2
    if half == 0:
        return 50.0, "Not enough data points."
    first_half_mean = vals.iloc[:half].mean()
    second_half_mean = vals.iloc[half:].mean()
    if first_half_mean == 0:
        return 50.0, "First half mean is zero."
    pct_change = (second_half_mean - first_half_mean) / abs(first_half_mean) * 100
    score = max(0.0, min(100.0, 50 + pct_change * 0.5))
    direction = "grew" if pct_change > 0 else "declined"
    return round(score, 1), f"Revenue {direction} by {abs(pct_change):.1f}% comparing first vs second half of dataset."


def _risk_score(df: pd.DataFrame, rev_col: str | None) -> tuple[float, str]:
    """Risk = missing data penalty + outlier penalty + concentration penalty."""
    risk_factors: list[str] = []
    penalty = 0.0

    # Missing data penalty
    missing_pct = df.isnull().mean().mean() * 100
    if missing_pct > 30:
        penalty += 30
        risk_factors.append(f"High missing data ({missing_pct:.1f}%)")
    elif missing_pct > 10:
        penalty += 15
        risk_factors.append(f"Moderate missing data ({missing_pct:.1f}%)")

    # Outlier penalty in revenue
    if rev_col:
        vals = _numeric_series(df, rev_col)
        if len(vals) > 10:
            z_scores = np.abs((vals - vals.mean()) / (vals.std() + 1e-9))
            outlier_pct = (z_scores > 3).mean() * 100
            if outlier_pct > 5:
                penalty += 25
                risk_factors.append(f"High outlier rate ({outlier_pct:.1f}%)")
            elif outlier_pct > 1:
                penalty += 10
                risk_factors.append(f"Moderate outliers ({outlier_pct:.1f}%)")

        # Concentration risk: top 20% of records driving >80% of revenue (Pareto)
        sorted_vals = vals.sort_values(ascending=False)
        top_20_cutoff = max(1, int(len(sorted_vals) * 0.2))
        top_20_share = sorted_vals.iloc[:top_20_cutoff].sum() / (sorted_vals.sum() + 1e-9)
        if top_20_share > 0.85:
            penalty += 20
            risk_factors.append(f"High revenue concentration (top 20% drives {top_20_share*100:.0f}%)")
        elif top_20_share > 0.70:
            penalty += 10
            risk_factors.append(f"Moderate revenue concentration ({top_20_share*100:.0f}%)")

    # Low row count risk
    if len(df) < 50:
        penalty += 15
        risk_factors.append("Small dataset (< 50 rows) — limited statistical confidence")

    score = max(0.0, min(100.0, 100 - penalty))
    explanation = "; ".join(risk_factors) if risk_factors else "No significant risk factors detected."
    return round(score, 1), explanation


def calculate_health_scores(df: pd.DataFrame, analysis: dict | None = None) -> dict:
    rev_col = _find_col(df, _REVENUE_SYNS)
    date_col = _find_col(df, _DATE_SYNS)

    stability_score, stability_note = _revenue_stability_score(df, rev_col)
    growth_score, growth_note = _growth_score(df, rev_col, date_col)
    risk_score_val, risk_note = _risk_score(df, rev_col)

    # Overall: weighted composite
    overall = round(
        stability_score * 0.35 + growth_score * 0.35 + risk_score_val * 0.30,
        1
    )

    def _grade(score: float) -> str:
        if score >= 80:
            return "A"
        if score >= 65:
            return "B"
        if score >= 50:
            return "C"
        if score >= 35:
            return "D"
        return "F"

    def _color(score: float) -> str:
        if score >= 75:
            return "green"
        if score >= 50:
            return "yellow"
        return "red"

    return {
        "overall": {
            "score": overall,
            "grade": _grade(overall),
            "color": _color(overall),
            "label": "Overall Business Health",
            "explanation": "Composite of revenue stability, growth trend, and risk assessment."
        },
        "revenue_stability": {
            "score": stability_score,
            "grade": _grade(stability_score),
            "color": _color(stability_score),
            "label": "Revenue Stability",
            "explanation": stability_note
        },
        "growth": {
            "score": growth_score,
            "grade": _grade(growth_score),
            "color": _color(growth_score),
            "label": "Growth Score",
            "explanation": growth_note
        },
        "risk": {
            "score": risk_score_val,
            "grade": _grade(risk_score_val),
            "color": _color(risk_score_val),
            "label": "Risk Score",
            "explanation": risk_note
        }
    }
