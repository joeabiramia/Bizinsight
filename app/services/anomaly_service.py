"""Anomaly Detection Service.

Uses Z-score + IQR to detect statistical outliers per numeric column.
Returns anomaly rows with coordinates for visual overlay on charts.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy import stats

from app.dataframe_utils import safe_number


def _numeric_cols(df: pd.DataFrame) -> list[str]:
    result = []
    for col in df.columns:
        series = df[col].apply(safe_number).dropna()
        if len(series) >= 5 and pd.api.types.is_numeric_dtype(series):
            result.append(col)
        elif len(series) >= 5:
            try:
                series.astype(float)
                result.append(col)
            except Exception:
                pass
    return result


def _detect_column_anomalies(series: pd.Series, method: str = "zscore") -> pd.Series:
    """Return boolean mask of anomalies."""
    vals = series.apply(safe_number).fillna(np.nan)
    clean = vals.dropna()
    mask = pd.Series(False, index=series.index)

    if len(clean) < 5:
        return mask

    if method == "zscore":
        z = np.abs(stats.zscore(clean.values, nan_policy="omit"))
        anomaly_idx = clean.index[z > 2.5]
        mask.loc[anomaly_idx] = True
    elif method == "iqr":
        q1, q3 = clean.quantile(0.25), clean.quantile(0.75)
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        anomaly_idx = clean.index[(clean < lower) | (clean > upper)]
        mask.loc[anomaly_idx] = True

    return mask


def detect_anomalies(df: pd.DataFrame) -> dict:
    numeric_cols = _numeric_cols(df)
    anomaly_summary: dict[str, dict] = {}
    all_anomaly_rows: set[int] = set()

    for col in numeric_cols[:8]:  # cap at 8 columns
        series = df[col].apply(safe_number)
        clean = series.dropna()
        if len(clean) < 5:
            continue

        # Use Z-score, fall back to IQR
        z_mask = _detect_column_anomalies(df[col], method="zscore")
        iqr_mask = _detect_column_anomalies(df[col], method="iqr")
        combined_mask = z_mask | iqr_mask

        anomaly_indices = df.index[combined_mask].tolist()
        all_anomaly_rows.update(anomaly_indices)

        if not anomaly_indices:
            continue

        anomaly_values = series.loc[anomaly_indices].tolist()
        normal_mean = clean[~combined_mask.loc[clean.index]].mean()
        normal_std = clean[~combined_mask.loc[clean.index]].std()

        # Build point data for chart overlay
        points = []
        for idx, val in zip(anomaly_indices, anomaly_values):
            if val is not None and not np.isnan(float(val)):
                severity = "critical" if abs(float(val) - normal_mean) > 3 * normal_std else "warning"
                points.append({
                    "row_index": int(idx),
                    "value": round(float(val), 4),
                    "deviation_sigma": round(abs(float(val) - normal_mean) / (normal_std + 1e-9), 2),
                    "severity": severity
                })

        anomaly_summary[col] = {
            "count": len(points),
            "percentage": round(len(points) / len(df) * 100, 2),
            "normal_mean": round(float(normal_mean), 4) if not np.isnan(normal_mean) else None,
            "normal_std": round(float(normal_std), 4) if not np.isnan(normal_std) else None,
            "anomaly_points": points[:50],  # return at most 50 anomaly points per column
        }

    # Build time-indexed anomaly series for each column (for chart rendering)
    chart_series: dict[str, list[dict]] = {}
    for col in list(anomaly_summary.keys())[:4]:
        series = df[col].apply(safe_number)
        anomaly_mask = pd.Series(False, index=df.index)
        for pt in anomaly_summary[col]["anomaly_points"]:
            anomaly_mask.loc[pt["row_index"]] = True

        points_data = []
        for i, (val, is_anomaly) in enumerate(zip(series, anomaly_mask)):
            if val is not None and not (isinstance(val, float) and np.isnan(val)):
                points_data.append({
                    "index": i,
                    "value": round(float(val), 4),
                    "anomaly": bool(is_anomaly)
                })
        chart_series[col] = points_data

    total_anomaly_rows = len(all_anomaly_rows)
    return {
        "total_anomaly_rows": total_anomaly_rows,
        "anomaly_rate_pct": round(total_anomaly_rows / len(df) * 100, 2) if len(df) > 0 else 0,
        "columns_with_anomalies": len(anomaly_summary),
        "column_anomalies": anomaly_summary,
        "chart_series": chart_series,
        "summary": (
            f"Detected {total_anomaly_rows} anomalous rows across {len(anomaly_summary)} columns "
            f"({round(total_anomaly_rows/len(df)*100, 1) if len(df) > 0 else 0}% of dataset)."
        )
    }
