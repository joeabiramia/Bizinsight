"""Goal-Based Forecasting.

GET /goal-forecast/{file_id}?target=500000&column=revenue
  → How many months to reach target, required growth rate, probability, recommendations.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query

from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_workspace_user
from app.services.analytics_engine import _date_col as _find_date_col, resolve_columns
from app.storage import get_file_record_for_user

router = APIRouter(tags=["goal-forecast"])


@router.get("/goal-forecast/{file_id}")
def goal_forecast(
    file_id: str,
    target: float = Query(..., description="Revenue/metric target to reach"),
    column: str = Query("", description="Column name (auto-detected if blank)"),
    wu: dict = Depends(get_workspace_user),
):
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    df = load_dataframe(file_doc["path"])

    # Resolve column — use analytics engine for dynamic schema detection
    resolved = resolve_columns(df, "revenue total forecast")
    col = column if column and column in df.columns else (resolved["metric_col"] or "")
    if not col:
        numeric_cols = df.select_dtypes(include="number").columns.tolist()
        if not numeric_cols:
            raise HTTPException(status_code=422, detail="No numeric columns found.")
        col = numeric_cols[0]

    date_col = _find_date_col(df)
    vals_raw = df[col].apply(safe_number).dropna()

    if len(vals_raw) < 4:
        raise HTTPException(status_code=422, detail="Not enough data for goal forecasting (need at least 4 data points).")

    # Build periodic series
    if date_col:
        try:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            temp = pd.DataFrame({"_v": vals_raw, "_d": dates}).dropna()
            temp["_p"] = temp["_d"].dt.to_period("M")
            series = temp.groupby("_p")["_v"].sum().sort_index()
            period_label = "month"
        except Exception:
            series = None
    else:
        series = None

    if series is None or len(series) < 4:
        series = pd.Series(vals_raw.values)
        period_label = "record"

    current_total = float(series.iloc[-1])
    series_vals = series.values.astype(float)

    # Fit linear trend
    x = np.arange(len(series_vals))
    try:
        coeffs = np.polyfit(x, series_vals, 1)
        slope = float(coeffs[0])
        intercept = float(coeffs[1])
    except Exception:
        slope = 0.0
        intercept = current_total

    # Project forward to reach target
    if slope <= 0:
        # Negative trend — compute how many periods at current pace
        months_required = None
        required_growth_pct = None
        on_track = False
        trend_direction = "declining"
    else:
        # Solve: intercept + slope * (n+len) = target
        n_extra = (target - (intercept + slope * len(series_vals))) / slope
        months_required = max(1, int(np.ceil(n_extra))) if n_extra > 0 else 0
        required_growth_pct = round((slope / abs(current_total) * 100), 2) if current_total != 0 else 0
        on_track = months_required <= 24
        trend_direction = "growing"

    # Monthly growth rate
    if len(series_vals) >= 2 and series_vals[-2] != 0:
        mom_growth = (series_vals[-1] - series_vals[-2]) / abs(series_vals[-2]) * 100
    else:
        mom_growth = 0.0

    # Gap analysis
    gap = target - current_total
    gap_pct = gap / abs(current_total) * 100 if current_total != 0 else 0

    # Forecast next 12 periods
    forecast_periods = []
    for i in range(1, 13):
        projected = intercept + slope * (len(series_vals) + i - 1)
        forecast_periods.append({
            "period": i,
            "projected_value": round(float(projected), 2),
            "label": f"+{i} {period_label}{'s' if i > 1 else ''}",
            "reached_target": projected >= target,
        })

    # Recommendations
    recommendations = []
    if slope <= 0:
        recommendations.append(f"Current trend is {trend_direction}. Reverse the trend before targeting growth.")
        recommendations.append(f"Focus on recovering {col} in underperforming segments first.")
    elif months_required and months_required <= 6:
        recommendations.append(f"You're on pace to hit the target in ~{months_required} {period_label}s. Maintain current growth.")
    elif months_required and months_required <= 18:
        recommendations.append(f"Target achievable in ~{months_required} {period_label}s if current growth rate continues.")
        recommendations.append(f"Current MoM growth: {mom_growth:.1f}%. Aim for {max(mom_growth * 1.2, 5):.1f}% to accelerate.")
    else:
        recommendations.append(f"At current pace, target may take {months_required or '>24'} {period_label}s. Consider a growth initiative.")
        recommendations.append("Identify top-performing segments and reallocate resources to accelerate growth.")

    recommendations.append(f"Gap to target: {gap:,.0f} ({gap_pct:.1f}%) — bridge by expanding in your highest-performing region or product.")

    return {
        "file_id": file_id,
        "column": col,
        "target": target,
        "current_value": round(current_total, 2),
        "gap": round(gap, 2),
        "gap_pct": round(gap_pct, 2),
        "trend_direction": trend_direction,
        "mom_growth_pct": round(mom_growth, 2),
        "months_required": months_required,
        "period_label": period_label,
        "on_track": on_track,
        "forecast": forecast_periods,
        "recommendations": recommendations,
    }
