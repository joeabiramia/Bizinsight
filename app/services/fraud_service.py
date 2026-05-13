"""Fraud and Suspicious Activity Detection Service.

Detects unusual patterns:
- Unusually high discounts
- Abnormal transaction amounts (statistical outliers)
- Suspicious high-frequency customers
- Sudden salesperson performance spikes
- Off-hours transaction activity
"""
from __future__ import annotations

import pandas as pd
import numpy as np

from app.dataframe_utils import safe_number

_DISCOUNT_SYNS = ["discount", "promo", "rebate", "reduction", "coupon"]
_AMOUNT_SYNS = ["amount", "revenue", "sales", "price", "total", "value", "cost"]
_DATE_SYNS = ["date", "time", "created", "updated", "timestamp", "datetime"]
_CUSTOMER_SYNS = ["customer", "client", "buyer", "account"]
_SALESMAN_SYNS = ["salesman", "salesperson", "sales_rep", "agent", "employee", "seller", "rep"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _zscore_series(series: pd.Series) -> pd.Series:
    mean = series.mean()
    std = series.std()
    if std == 0:
        return pd.Series(0.0, index=series.index)
    return (series - mean) / std


def detect_fraud_patterns(df: pd.DataFrame) -> dict:
    """Detect suspicious patterns using statistical analysis."""
    alerts: list[dict] = []

    discount_col = _find_col(df, _DISCOUNT_SYNS)
    amount_col = _find_col(df, _AMOUNT_SYNS)
    date_col = _find_col(df, _DATE_SYNS)
    customer_col = _find_col(df, _CUSTOMER_SYNS)
    salesman_col = _find_col(df, _SALESMAN_SYNS)

    # 1. Unusually high discounts
    if discount_col:
        vals = df[discount_col].apply(safe_number).dropna()
        if len(vals) >= 5:
            zscores = _zscore_series(vals)
            high_mask = zscores > 2.5
            high_rows = df[high_mask].head(10)
            for idx, row in high_rows.iterrows():
                val = safe_number(row[discount_col])
                alerts.append({
                    "type": "high_discount",
                    "severity": "high",
                    "title": "Unusually High Discount",
                    "description": (
                        f"Discount of {val} is significantly above average "
                        f"(z-score > 2.5) in row {idx}"
                    ),
                    "row_index": int(idx),
                    "column": discount_col,
                    "value": float(val) if val is not None else None,
                    "recommendation": "Verify this discount was properly authorized",
                })

    # 2. Abnormal transaction amounts
    if amount_col:
        vals = df[amount_col].apply(safe_number).dropna()
        if len(vals) >= 5:
            q1 = vals.quantile(0.25)
            q3 = vals.quantile(0.75)
            iqr = q3 - q1
            if iqr > 0:
                extreme_upper = q3 + 4 * iqr
                extreme_lower = max(0.0, q1 - 4 * iqr)
                numeric_col = df[amount_col].apply(safe_number)
                abnormal_mask = (numeric_col > extreme_upper) | (numeric_col < extreme_lower)
                for idx, row in df[abnormal_mask].head(10).iterrows():
                    val = safe_number(row[amount_col])
                    direction = "exceptionally high" if val and val > extreme_upper else "suspiciously low"
                    alerts.append({
                        "type": "abnormal_amount",
                        "severity": "high" if direction == "exceptionally high" else "medium",
                        "title": "Abnormal Transaction Amount",
                        "description": f"Amount {val:,.2f} is {direction} (outside 4×IQR bounds)",
                        "row_index": int(idx),
                        "column": amount_col,
                        "value": float(val) if val is not None else None,
                        "recommendation": "Verify this transaction with the responsible team",
                    })

    # 3. Suspicious high-frequency customers
    if customer_col:
        customer_counts = df[customer_col].value_counts()
        if len(customer_counts) >= 5:
            threshold = max(5, float(customer_counts.quantile(0.99)))
            suspicious_customers = customer_counts[customer_counts > threshold]
            for customer, count in suspicious_customers.head(5).items():
                total_amount = 0.0
                if amount_col:
                    total_amount = float(
                        df[df[customer_col] == customer][amount_col]
                        .apply(safe_number).dropna().sum()
                    )
                alerts.append({
                    "type": "high_frequency_customer",
                    "severity": "medium",
                    "title": "High-Frequency Customer Activity",
                    "description": f"Customer '{customer}' appears {count} times (top 1% frequency)",
                    "column": customer_col,
                    "value": str(customer),
                    "transaction_count": int(count),
                    "total_amount": round(total_amount, 2),
                    "recommendation": f"Review {count} transactions from '{customer}' for legitimacy",
                })

    # 4. Sudden salesperson performance spikes
    if salesman_col and amount_col:
        grouped = df.groupby(salesman_col)[amount_col].apply(
            lambda s: s.apply(safe_number).dropna().sum()
        )
        if len(grouped) >= 3:
            zscores = _zscore_series(grouped)
            for sp, zscore in zscores[zscores > 3.0].items():
                alerts.append({
                    "type": "performance_spike",
                    "severity": "medium",
                    "title": "Unusual Salesperson Performance Spike",
                    "description": (
                        f"'{sp}' has anomalously high total sales "
                        f"(z-score: {zscore:.1f} standard deviations above average)"
                    ),
                    "column": salesman_col,
                    "value": str(sp),
                    "z_score": round(float(zscore), 2),
                    "recommendation": f"Verify sales records for '{sp}' — performance is statistically unusual",
                })

    # 5. Off-hours transaction activity
    if date_col and amount_col:
        try:
            temp = df[[date_col, amount_col]].copy()
            temp["_date"] = pd.to_datetime(temp[date_col], errors="coerce")
            temp = temp.dropna(subset=["_date"])
            temp["_amount"] = temp[amount_col].apply(safe_number)
            temp["_hour"] = temp["_date"].dt.hour
            off_hours = temp[(temp["_hour"] < 6) | (temp["_hour"] > 22)]
            total_amount = float(temp["_amount"].dropna().sum())
            off_hours_amount = float(off_hours["_amount"].dropna().sum())
            if total_amount > 0 and off_hours_amount / total_amount > 0.15:
                pct = off_hours_amount / total_amount * 100
                alerts.append({
                    "type": "off_hours_activity",
                    "severity": "low",
                    "title": "Off-Hours Transaction Activity",
                    "description": (
                        f"{len(off_hours)} transactions occur outside 6am–10pm, "
                        f"representing {pct:.1f}% of total transaction value"
                    ),
                    "column": date_col,
                    "value": f"{len(off_hours)} transactions",
                    "recommendation": "Review off-hours transactions to confirm they are authorized",
                })
        except Exception:
            pass

    # Build summary
    high = sum(1 for a in alerts if a["severity"] == "high")
    medium = sum(1 for a in alerts if a["severity"] == "medium")
    low = sum(1 for a in alerts if a["severity"] == "low")
    risk_score = min(100, high * 25 + medium * 10 + low * 5)
    risk_level = (
        "critical" if risk_score >= 75 else
        "high" if risk_score >= 50 else
        "medium" if risk_score >= 25 else
        "low"
    )

    return {
        "total_alerts": len(alerts),
        "high_severity": high,
        "medium_severity": medium,
        "low_severity": low,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "alerts": alerts,
        "columns_analyzed": {
            "discount": discount_col,
            "amount": amount_col,
            "date": date_col,
            "customer": customer_col,
            "salesperson": salesman_col,
        },
        "summary": (
            f"Fraud scan complete: {len(alerts)} suspicious patterns detected "
            f"({high} critical, {medium} medium, {low} low). "
            f"Risk score: {risk_score}/100 — {risk_level.upper()}."
        ),
    }
