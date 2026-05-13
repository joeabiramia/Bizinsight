"""Smart AI Notification Engine.

Scans dataset analysis results and generates actionable notifications
with severity levels: critical / warning / info.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders"]
_DATE_SYNS = ["date", "month", "week", "year", "period", "time", "created"]
_REGION_SYNS = ["region", "territory", "area", "country", "state", "city", "zone"]
_SALESMAN_SYNS = ["salesman", "salesperson", "sales_rep", "agent", "employee", "seller", "rep"]
_PRODUCT_SYNS = ["product", "item", "sku", "category"]


def _find_col(df: pd.DataFrame, synonyms: list[str]) -> str | None:
    for syn in synonyms:
        for col in df.columns:
            parts = str(col).lower().replace(" ", "_").replace("-", "_").split("_")
            if syn in parts or str(col).lower() == syn:
                return col
    return None


def _num(df: pd.DataFrame, col: str) -> pd.Series:
    return df[col].apply(safe_number).dropna()


def _make_notification(
    title: str,
    message: str,
    severity: str,
    notification_type: str,
    file_id: str,
    user_id: str,
    metadata: dict | None = None,
) -> dict:
    return {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_id,
        "file_id": file_id,
        "title": title,
        "message": message,
        "severity": severity,  # "critical" | "warning" | "info"
        "type": notification_type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "metadata": metadata or {},
    }


def generate_notifications(
    df: pd.DataFrame,
    analysis: dict,
    user_id: str,
    file_id: str,
) -> list[dict]:
    notifications: list[dict] = []
    rev_col = _find_col(df, _REVENUE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    date_col = _find_col(df, _DATE_SYNS)
    region_col = _find_col(df, _REGION_SYNS)
    salesman_col = _find_col(df, _SALESMAN_SYNS)
    product_col = _find_col(df, _PRODUCT_SYNS)

    # ── 1. Revenue trend alert ────────────────────────────────────────────────
    if rev_col and date_col:
        try:
            temp = pd.DataFrame({
                "_rev": df[rev_col].apply(safe_number),
                "_date": pd.to_datetime(df[date_col], errors="coerce")
            }).dropna()
            temp["_period"] = temp["_date"].dt.to_period("M")
            monthly = temp.groupby("_period")["_rev"].sum().sort_index()
            if len(monthly) >= 3:
                last = float(monthly.iloc[-1])
                prev = float(monthly.iloc[-2])
                if prev != 0:
                    pct_change = (last - prev) / abs(prev) * 100
                    if pct_change < -15:
                        notifications.append(_make_notification(
                            title="Critical Revenue Drop Detected",
                            message=f"Revenue fell by {abs(pct_change):.1f}% in the latest period. Immediate attention required.",
                            severity="critical",
                            notification_type="revenue_drop",
                            file_id=file_id, user_id=user_id,
                            metadata={"pct_change": round(pct_change, 2), "column": rev_col}
                        ))
                    elif pct_change < -5:
                        notifications.append(_make_notification(
                            title="Revenue Decline Warning",
                            message=f"Revenue dropped {abs(pct_change):.1f}% vs previous period. Monitor closely.",
                            severity="warning",
                            notification_type="revenue_drop",
                            file_id=file_id, user_id=user_id,
                            metadata={"pct_change": round(pct_change, 2), "column": rev_col}
                        ))
                    elif pct_change > 20:
                        notifications.append(_make_notification(
                            title="Revenue Surge Detected",
                            message=f"Revenue grew {pct_change:.1f}% in the latest period — capitalize on this momentum.",
                            severity="info",
                            notification_type="revenue_surge",
                            file_id=file_id, user_id=user_id,
                            metadata={"pct_change": round(pct_change, 2), "column": rev_col}
                        ))
        except Exception:
            pass

    # ── 2. Region underperformance ────────────────────────────────────────────
    if region_col and rev_col:
        try:
            grouped = df.groupby(region_col)[rev_col].apply(lambda s: _num(s.to_frame(), rev_col) if False else s.apply(safe_number).dropna().sum())
            if len(grouped) >= 3:
                mean_rev = grouped.mean()
                for region, rev_val in grouped.items():
                    if rev_val < mean_rev * 0.5:
                        notifications.append(_make_notification(
                            title=f"Region Underperforming: {region}",
                            message=f"'{region}' revenue (${rev_val:,.0f}) is {((1 - rev_val/mean_rev)*100):.0f}% below average (${mean_rev:,.0f}). Investigate root cause.",
                            severity="warning",
                            notification_type="region_underperforming",
                            file_id=file_id, user_id=user_id,
                            metadata={"region": str(region), "revenue": round(float(rev_val), 2)}
                        ))
                        break  # one region alert at a time
        except Exception:
            pass

    # ── 3. High-demand product ────────────────────────────────────────────────
    if product_col and qty_col:
        try:
            grouped = df.groupby(product_col)[qty_col].apply(lambda s: s.apply(safe_number).dropna().sum()).sort_values(ascending=False)
            if len(grouped) >= 2:
                top_product = str(grouped.index[0])
                top_qty = float(grouped.iloc[0])
                mean_qty = float(grouped.mean())
                if top_qty > mean_qty * 2:
                    notifications.append(_make_notification(
                        title=f"High-Demand Product: {top_product}",
                        message=f"'{top_product}' demand ({top_qty:,.0f} units) is {(top_qty/mean_qty):.1f}× the average — ensure sufficient inventory.",
                        severity="info",
                        notification_type="high_demand_product",
                        file_id=file_id, user_id=user_id,
                        metadata={"product": top_product, "quantity": round(top_qty, 2)}
                    ))
        except Exception:
            pass

    # ── 4. Anomaly / outlier detection ───────────────────────────────────────
    if rev_col:
        try:
            vals = _num(df, rev_col)
            if len(vals) >= 10:
                z_scores = np.abs((vals - vals.mean()) / (vals.std() + 1e-9))
                extreme_count = int((z_scores > 3).sum())
                if extreme_count > 0:
                    notifications.append(_make_notification(
                        title=f"Suspicious Revenue Anomalies Detected",
                        message=f"{extreme_count} transaction(s) show extreme revenue values (>3σ deviation). Review for data errors or fraud.",
                        severity="critical" if extreme_count > 5 else "warning",
                        notification_type="anomaly_detected",
                        file_id=file_id, user_id=user_id,
                        metadata={"anomaly_count": extreme_count, "column": rev_col}
                    ))
        except Exception:
            pass

    # ── 5. Salesperson performance drop ──────────────────────────────────────
    if salesman_col and rev_col:
        try:
            grouped = df.groupby(salesman_col)[rev_col].apply(lambda s: s.apply(safe_number).dropna().sum()).sort_values()
            if len(grouped) >= 3:
                worst_name = str(grouped.index[0])
                worst_val = float(grouped.iloc[0])
                avg_val = float(grouped.mean())
                if worst_val < avg_val * 0.4:
                    notifications.append(_make_notification(
                        title=f"Salesperson Performance Alert: {worst_name}",
                        message=f"'{worst_name}' revenue (${worst_val:,.0f}) is {((1-worst_val/avg_val)*100):.0f}% below team average. Performance review recommended.",
                        severity="warning",
                        notification_type="salesperson_underperforming",
                        file_id=file_id, user_id=user_id,
                        metadata={"salesperson": worst_name, "revenue": round(worst_val, 2)}
                    ))
        except Exception:
            pass

    # ── 6. Data quality warnings ──────────────────────────────────────────────
    missing_pct = df.isnull().mean()
    bad_cols = missing_pct[missing_pct > 0.3].index.tolist()
    if bad_cols:
        notifications.append(_make_notification(
            title="Data Quality Issue Detected",
            message=f"{len(bad_cols)} column(s) have >30% missing values: {', '.join(str(c) for c in bad_cols[:3])}. Data quality may affect analysis accuracy.",
            severity="warning",
            notification_type="data_quality",
            file_id=file_id, user_id=user_id,
            metadata={"affected_columns": bad_cols}
        ))

    # ── 7. Revenue concentration risk ────────────────────────────────────────
    if rev_col:
        try:
            vals = _num(df, rev_col).sort_values(ascending=False)
            top20_cutoff = max(1, int(len(vals) * 0.2))
            top20_share = float(vals.iloc[:top20_cutoff].sum() / (vals.sum() + 1e-9))
            if top20_share > 0.85:
                notifications.append(_make_notification(
                    title="Revenue Concentration Risk",
                    message=f"Top 20% of transactions generate {top20_share*100:.0f}% of total revenue. High dependency on few large deals.",
                    severity="warning",
                    notification_type="revenue_concentration",
                    file_id=file_id, user_id=user_id,
                    metadata={"concentration_pct": round(top20_share * 100, 1)}
                ))
        except Exception:
            pass

    # Sort by severity (critical first)
    order = {"critical": 0, "warning": 1, "info": 2}
    notifications.sort(key=lambda n: order.get(n["severity"], 3))

    return notifications
