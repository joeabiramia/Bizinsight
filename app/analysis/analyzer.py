import math
from datetime import datetime

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number


def _sanitize(obj):
    """Recursively convert numpy/pandas types to JSON-safe Python native types."""
    if isinstance(obj, dict):
        return {str(k): _sanitize(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize(item) for item in obj]
    if isinstance(obj, np.bool_):
        return bool(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    if isinstance(obj, np.floating):
        v = float(obj)
        return None if (math.isnan(v) or math.isinf(v)) else v
    if isinstance(obj, np.ndarray):
        return [_sanitize(x) for x in obj.tolist()]
    if isinstance(obj, float):
        return None if (math.isnan(obj) or math.isinf(obj)) else obj
    return obj


def classify_columns(df: pd.DataFrame):
    """Return (numeric, categorical, datetime) column lists."""
    numeric = list(df.select_dtypes(include="number").columns)
    datetime_cols = list(df.select_dtypes(include=["datetime", "datetimetz"]).columns)
    categorical = []

    for col in df.columns:
        if col in numeric or col in datetime_cols:
            continue
        # Try to detect datetime strings
        if df[col].dtype == object:
            sample = df[col].dropna().head(200)
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() > 0.7:
                    datetime_cols.append(col)
                    continue
            except Exception:
                pass
        # Treat as categorical if cardinality is reasonable
        n_unique = df[col].nunique(dropna=True)
        if 1 < n_unique <= max(30, int(len(df) * 0.05)):
            categorical.append(col)

    return numeric, categorical, datetime_cols


def _pick_main_numeric(df: pd.DataFrame, numeric_cols: list) -> str | None:
    """Return the numeric column with the highest total (best proxy for 'value')."""
    if not numeric_cols:
        return None
    return max(
        numeric_cols,
        key=lambda c: df[c].apply(safe_number).fillna(0).sum(),
    )


def aggregate_by_column(df, group_col, value_col=None, top_n=6):
    if not group_col or group_col not in df.columns:
        return []
    if value_col and value_col in df.columns:
        temp = df[[group_col, value_col]].copy()
        temp["_value"] = temp[value_col].apply(safe_number).fillna(0)
        grouped = temp.groupby(group_col, dropna=False)["_value"].sum().reset_index()
        grouped = grouped.rename(columns={"_value": "value", group_col: "name"})
    else:
        grouped = df[group_col].fillna("Unknown").value_counts().reset_index()
        grouped.columns = ["name", "value"]
    grouped["name"] = grouped["name"].fillna("Unknown").astype(str)
    grouped = grouped.sort_values(by="value", ascending=False).head(top_n)
    return grouped.to_dict(orient="records")


def build_distribution(series: pd.Series, bins: int = 6) -> list:
    """Build a histogram distribution from a numeric series."""
    values = series.dropna()
    if values.empty or values.nunique() < 2:
        return []
    try:
        cut, bin_edges = pd.cut(values, bins=bins, retbins=True, duplicates="drop")
        counts = cut.value_counts().sort_index()
        result = []
        for interval, count in counts.items():
            left = bin_edges[list(counts.index).index(interval)]
            right = bin_edges[list(counts.index).index(interval) + 1]
            label = f"{left:.1f}–{right:.1f}"
            result.append({"range": label, "count": int(count)})
        return result
    except Exception:
        return []


def build_time_series(df: pd.DataFrame, dt_col: str, value_col: str) -> list:
    """Aggregate a value column by month."""
    try:
        temp = df[[dt_col, value_col]].copy()
        temp[dt_col] = pd.to_datetime(temp[dt_col], infer_datetime_format=True, errors="coerce")
        temp = temp.dropna(subset=[dt_col])
        temp["_value"] = temp[value_col].apply(safe_number).fillna(0)
        temp["_month"] = temp[dt_col].dt.to_period("M").astype(str)
        grouped = temp.groupby("_month")["_value"].sum().reset_index()
        grouped.columns = ["month", "value"]
        grouped = grouped.sort_values("month")
        return grouped.to_dict(orient="records")
    except Exception:
        return []


def detect_industry(df: pd.DataFrame) -> str:
    """Return the detected industry label using the confidence-scored classifier."""
    from app.services.dataset_classifier import classify_dataset
    result = classify_dataset(df)
    return result.label


def analyze_dataframe(df: pd.DataFrame) -> dict:
    df = df.copy()
    numeric_cols, categorical_cols, datetime_cols = classify_columns(df)
    numeric_df = df[numeric_cols] if numeric_cols else pd.DataFrame()

    summary = {
        "columns": [str(col) for col in df.columns],
        "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "data_types": df.dtypes.astype(str).to_dict(),
        "missing_values": df.isnull().sum().astype(int).to_dict(),
        "preview": df.head(10).fillna("").to_dict(orient="records"),
        "column_types": {
            "numeric": numeric_cols,
            "categorical": categorical_cols,
            "datetime": datetime_cols,
        },
    }

    try:
        summary["statistics"] = _sanitize(df.describe(include="all").fillna("").to_dict())
    except Exception:
        summary["statistics"] = {}

    try:
        summary["correlations"] = (
            _sanitize(numeric_df.corr().fillna(0).to_dict())
            if numeric_df.shape[1] > 1
            else {}
        )
    except Exception:
        summary["correlations"] = {}

    main_numeric = _pick_main_numeric(df, numeric_cols)

    # Dynamic numeric summary
    numeric_summary = {}
    for col in numeric_cols[:8]:
        vals = df[col].apply(safe_number).dropna()
        if vals.empty:
            continue
        numeric_summary[str(col)] = {
            "total": float(vals.sum()),
            "mean": float(vals.mean()),
            "median": float(vals.median()),
            "std": float(vals.std()) if len(vals) > 1 else 0.0,
            "min": float(vals.min()),
            "max": float(vals.max()),
            "p90": float(vals.quantile(0.9)),
        }
    summary["numeric_summary"] = numeric_summary

    # Dynamic categorical summary
    categorical_summary = {}
    for col in categorical_cols[:8]:
        vc = df[col].value_counts(dropna=False)
        categorical_summary[str(col)] = {
            "unique_count": int(df[col].nunique(dropna=True)),
            "top_value": str(vc.index[0]) if not vc.empty else None,
            "top_count": int(vc.iloc[0]) if not vc.empty else 0,
        }
    summary["categorical_summary"] = categorical_summary

    # Dynamic chart data
    chart_data: dict = {}

    chart_data["kpi_means"] = [
        {"name": str(col), "value": float(df[col].mean())}
        for col in numeric_cols
        if pd.notna(df[col].mean())
    ]

    # One breakdown chart per categorical column (using main numeric as value)
    chart_data["breakdowns"] = {}
    for cat_col in categorical_cols[:6]:
        data = aggregate_by_column(df, cat_col, main_numeric, top_n=8)
        if data:
            chart_data["breakdowns"][str(cat_col)] = {
                "value_column": str(main_numeric) if main_numeric else None,
                "data": data,
            }

    # Count distribution for categorical cols with no numeric pair
    chart_data["category_counts"] = {}
    for cat_col in categorical_cols[:6]:
        data = aggregate_by_column(df, cat_col, None, top_n=8)
        if data:
            chart_data["category_counts"][str(cat_col)] = data

    # Numeric distributions
    chart_data["distributions"] = {}
    for col in numeric_cols[:6]:
        dist = build_distribution(df[col].apply(safe_number))
        if dist:
            chart_data["distributions"][str(col)] = dist

    # Time series for the first detected datetime column
    if datetime_cols and main_numeric:
        chart_data["time_series"] = build_time_series(df, datetime_cols[0], main_numeric)
        chart_data["time_series_meta"] = {
            "date_column": str(datetime_cols[0]),
            "value_column": str(main_numeric),
        }

    summary["chart_data"] = chart_data
    summary["industry"] = detect_industry(df)
    summary["generated_at"] = datetime.utcnow().isoformat() + "Z"
    return _sanitize(summary)
