"""Predictive Analytics Service.

Uses scikit-learn LinearRegression + polynomial features to forecast numeric trends.
Works on time series (if a date column exists) or row-indexed data.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.pipeline import make_pipeline

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders", "bookings"]
_DATE_SYNS = ["date", "month", "week", "year", "period", "time", "created"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _build_time_series(df: pd.DataFrame, value_col: str, date_col: str | None) -> pd.DataFrame | None:
    """Build a clean monthly aggregated time series, or row-indexed series."""
    try:
        vals = df[value_col].apply(safe_number)
        if date_col:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            temp = pd.DataFrame({"_val": vals, "_date": dates}).dropna()
            temp["_period"] = temp["_date"].dt.to_period("M")
            monthly = temp.groupby("_period")["_val"].sum().sort_index()
            if len(monthly) >= 4:
                ts = pd.DataFrame({
                    "period": monthly.index.astype(str),
                    "value": monthly.values.astype(float),
                    "x": np.arange(len(monthly))
                })
                return ts
    except Exception:
        pass

    # Fallback: row index (no date aggregation)
    clean = pd.DataFrame({"value": vals.dropna().values})
    clean["x"] = np.arange(len(clean))
    clean["period"] = [f"Row {i}" for i in clean["x"]]
    return clean if len(clean) >= 6 else None


def _forecast_column(ts: pd.DataFrame, horizon: int = 6) -> dict:
    """Fit polynomial regression and forecast `horizon` future steps."""
    x = ts["x"].values.reshape(-1, 1)
    y = ts["value"].values

    model = make_pipeline(PolynomialFeatures(degree=2), LinearRegression())
    model.fit(x, y)

    # In-sample fit
    y_pred = model.predict(x)
    residuals = y - y_pred
    std_residual = residuals.std()

    # Future forecast
    last_x = int(ts["x"].max())
    future_x = np.arange(last_x + 1, last_x + 1 + horizon).reshape(-1, 1)
    future_pred = model.predict(future_x)

    # Build future period labels
    last_period = ts["period"].iloc[-1]
    try:
        last_p = pd.Period(last_period, freq="M")
        future_periods = [(last_p + i + 1).strftime("%Y-%m") for i in range(horizon)]
    except Exception:
        future_periods = [f"T+{i+1}" for i in range(horizon)]

    # Confidence interval (±1.96σ)
    ci_upper = future_pred + 1.96 * std_residual
    ci_lower = future_pred - 1.96 * std_residual

    historical = [
        {"period": str(p), "actual": round(float(a), 2), "fitted": round(float(f), 2)}
        for p, a, f in zip(ts["period"], y, y_pred)
    ]
    forecast = [
        {
            "period": per,
            "forecast": round(float(fc), 2),
            "ci_lower": round(float(cl), 2),
            "ci_upper": round(float(cu), 2)
        }
        for per, fc, cl, cu in zip(future_periods, future_pred, ci_lower, ci_upper)
    ]

    # Trend direction
    trend_slope = float(np.polyfit(ts["x"].values, y, 1)[0])
    mean_val = float(np.mean(y)) if np.mean(y) != 0 else 1
    trend_pct = (trend_slope / abs(mean_val)) * 100
    trend_dir = "upward" if trend_slope > 0 else "downward"

    # R² score
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - y.mean()) ** 2)
    r2 = 1 - ss_res / (ss_tot + 1e-9)

    return {
        "historical": historical,
        "forecast": forecast,
        "trend_direction": trend_dir,
        "trend_pct_per_period": round(trend_pct, 2),
        "r2_score": round(float(r2), 4),
        "std_error": round(float(std_residual), 4),
        "horizon_periods": horizon,
    }


def generate_predictions(df: pd.DataFrame, analysis: dict | None = None) -> dict:
    """Generate forecasts for revenue and key numeric columns."""
    predictions: dict[str, dict] = {}
    errors: list[str] = []

    rev_col = _find_col(df, _REVENUE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    date_col = _find_col(df, _DATE_SYNS)

    target_cols: list[tuple[str, str]] = []
    if rev_col:
        target_cols.append((rev_col, "Revenue Forecast"))
    if qty_col and qty_col != rev_col:
        target_cols.append((qty_col, "Demand Forecast"))

    # Add top numeric columns if not already included
    if analysis and "column_types" in analysis:
        for num_col in analysis["column_types"].get("numeric", [])[:3]:
            if num_col != rev_col and num_col != qty_col:
                target_cols.append((num_col, f"{num_col} Forecast"))

    if not target_cols:
        # Fallback: use first numeric column
        for col in df.columns:
            series = df[col].apply(safe_number).dropna()
            if len(series) >= 6 and series.dtype in [np.float64, np.int64]:
                target_cols.append((col, f"{col} Forecast"))
                break

    for col, label in target_cols[:4]:
        try:
            ts = _build_time_series(df, col, date_col)
            if ts is None or len(ts) < 4:
                errors.append(f"{col}: insufficient data points for forecasting.")
                continue
            result = _forecast_column(ts, horizon=6)
            result["label"] = label
            result["column"] = col
            predictions[col] = result
        except Exception as e:
            errors.append(f"{col}: {str(e)}")

    has_time_series = date_col is not None
    return {
        "predictions": predictions,
        "date_column": date_col,
        "has_time_series": has_time_series,
        "forecast_horizon": 6,
        "model": "Polynomial Regression (degree=2)",
        "errors": errors,
        "summary": (
            f"Generated {len(predictions)} forecasts using "
            f"{'time series aggregation' if has_time_series else 'row-indexed trend analysis'}."
        )
    }
