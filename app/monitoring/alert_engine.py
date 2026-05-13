"""Real-Time Alert Engine.

Scans a dataset and produces actionable business alerts:
  - Revenue drops / spikes
  - Inventory risks
  - Region underperformance
  - Missing data spikes
  - Salesperson anomalies
  - Forecast trend reversals
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from typing import Any

from app.dataframe_utils import safe_number

_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders", "bookings", "stock"]
_DATE_SYNS = ["date", "month", "week", "year", "period", "time", "created"]
_REGION_SYNS = ["region", "territory", "area", "country", "state", "city", "zone", "district"]
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


def _alert(
    alert_type: str,
    title: str,
    message: str,
    severity: str,
    recommended_action: str,
    metadata: dict | None = None,
) -> dict:
    return {
        "type": alert_type,
        "title": title,
        "message": message,
        "severity": severity,
        "recommended_action": recommended_action,
        "metadata": metadata or {},
    }


# ── Individual detectors ──────────────────────────────────────────────────────

def _detect_revenue_drop(df: pd.DataFrame, rev_col: str | None, date_col: str | None) -> list[dict]:
    alerts = []
    if not rev_col:
        return alerts
    vals = _num(df, rev_col)
    if len(vals) < 4:
        return alerts

    if date_col:
        try:
            dates = pd.to_datetime(df[date_col], errors="coerce")
            temp = pd.DataFrame({"_val": vals, "_date": dates}).dropna()
            temp["_period"] = temp["_date"].dt.to_period("M")
            monthly = temp.groupby("_period")["_val"].sum().sort_index()
            if len(monthly) >= 3:
                last = float(monthly.iloc[-1])
                prev = float(monthly.iloc[-2])
                if prev > 0:
                    pct = (last - prev) / prev * 100
                    if pct <= -20:
                        sev = "high" if pct <= -40 else "medium"
                        alerts.append(_alert(
                            "risk", "Revenue Drop Detected",
                            f"{rev_col} fell {abs(pct):.1f}% in the most recent period "
                            f"(from {prev:,.0f} to {last:,.0f}).",
                            sev,
                            "Investigate root causes. Review recent orders, cancellations, or seasonal effects.",
                            {"column": rev_col, "change_pct": round(pct, 2)},
                        ))
                    elif pct >= 20:
                        alerts.append(_alert(
                            "opportunity", "Revenue Spike Detected",
                            f"{rev_col} surged {pct:.1f}% in the most recent period.",
                            "low",
                            "Identify what drove this spike and amplify those drivers.",
                            {"column": rev_col, "change_pct": round(pct, 2)},
                        ))
        except Exception:
            pass
        return alerts

    # Fallback: last 20% vs first 80% of rows
    split = max(1, int(len(vals) * 0.8))
    early_mean = float(vals.iloc[:split].mean())
    late_mean = float(vals.iloc[split:].mean())
    if early_mean > 0:
        pct = (late_mean - early_mean) / early_mean * 100
        if pct <= -20:
            alerts.append(_alert(
                "risk", "Revenue Declining Trend",
                f"Recent {rev_col} averages {abs(pct):.1f}% below earlier performance.",
                "medium",
                "Investigate declining sales. Consider promotions or product line review.",
                {"column": rev_col, "change_pct": round(pct, 2)},
            ))
    return alerts


def _detect_inventory_risk(df: pd.DataFrame, qty_col: str | None, product_col: str | None) -> list[dict]:
    alerts = []
    if not qty_col:
        return alerts
    vals = _num(df, qty_col)
    if vals.empty:
        return alerts

    mean_qty = float(vals.mean())
    std_qty = float(vals.std()) if len(vals) > 1 else 0
    low_threshold = max(0, mean_qty - 2 * std_qty)

    low_rows = df[vals <= low_threshold]
    if not low_rows.empty and product_col and product_col in df.columns:
        low_products = low_rows[product_col].value_counts().head(3)
        products_str = ", ".join(str(p) for p in low_products.index)
        alerts.append(_alert(
            "risk", "Low Inventory Risk",
            f"Products with critically low {qty_col}: {products_str}.",
            "high",
            "Reorder stock for affected products immediately to avoid stockouts.",
            {"low_products": list(low_products.index), "threshold": round(low_threshold, 2)},
        ))
    elif not low_rows.empty:
        count = len(low_rows)
        alerts.append(_alert(
            "risk", "Low Quantity Records Detected",
            f"{count} records show unusually low {qty_col} (below {low_threshold:.1f}).",
            "medium",
            "Review low-quantity transactions for data quality or restocking needs.",
            {"low_count": count, "threshold": round(low_threshold, 2)},
        ))
    return alerts


def _detect_region_underperformance(
    df: pd.DataFrame, rev_col: str | None, region_col: str | None
) -> list[dict]:
    alerts = []
    if not rev_col or not region_col:
        return alerts
    try:
        vals = _num(df, rev_col)
        temp = pd.DataFrame({"_val": vals, "_region": df[region_col]}).dropna()
        by_region = temp.groupby("_region")["_val"].sum()
        if len(by_region) < 2:
            return alerts
        mean_rev = float(by_region.mean())
        threshold = mean_rev * 0.5
        underperformers = by_region[by_region < threshold].sort_values()
        if not underperformers.empty:
            names = ", ".join(str(r) for r in underperformers.index[:3])
            alerts.append(_alert(
                "risk", "Region Underperformance",
                f"Regions {names} generate less than 50% of average {rev_col}.",
                "medium",
                "Investigate underperforming regions. Consider targeted campaigns or resource reallocation.",
                {"regions": list(underperformers.index[:3]), "avg_revenue": round(mean_rev, 2)},
            ))
        top = by_region.idxmax()
        top_share = float(by_region.max() / by_region.sum() * 100)
        if top_share > 60:
            alerts.append(_alert(
                "risk", "Geographic Revenue Concentration",
                f"Region '{top}' accounts for {top_share:.1f}% of total {rev_col}.",
                "low",
                "Diversify revenue across more regions to reduce concentration risk.",
                {"top_region": str(top), "share_pct": round(top_share, 1)},
            ))
    except Exception:
        pass
    return alerts


def _detect_missing_data_spike(df: pd.DataFrame) -> list[dict]:
    alerts = []
    total = len(df)
    if total == 0:
        return alerts
    for col in df.columns:
        missing = int(df[col].isna().sum())
        pct = missing / total * 100
        if pct >= 20:
            sev = "high" if pct >= 50 else "medium"
            alerts.append(_alert(
                "warning", f"High Missing Data: {col}",
                f"Column '{col}' has {missing} missing values ({pct:.1f}% of rows).",
                sev,
                f"Investigate data source for '{col}'. Consider imputation or data collection improvements.",
                {"column": col, "missing_count": missing, "missing_pct": round(pct, 1)},
            ))
    return alerts


def _detect_salesperson_anomaly(
    df: pd.DataFrame, rev_col: str | None, salesman_col: str | None
) -> list[dict]:
    alerts = []
    if not rev_col or not salesman_col:
        return alerts
    try:
        vals = _num(df, rev_col)
        temp = pd.DataFrame({"_val": vals, "_person": df[salesman_col]}).dropna()
        by_person = temp.groupby("_person")["_val"].sum()
        if len(by_person) < 3:
            return alerts
        mean_p = float(by_person.mean())
        std_p = float(by_person.std())
        if std_p == 0:
            return alerts
        z_scores = (by_person - mean_p) / std_p
        outliers_high = by_person[z_scores > 2.5]
        outliers_low = by_person[z_scores < -2.5]
        if not outliers_high.empty:
            name = str(outliers_high.idxmax())
            val = float(outliers_high.max())
            alerts.append(_alert(
                "opportunity", "Top Performer Identified",
                f"Salesperson '{name}' shows exceptionally high {rev_col} ({val:,.0f}). "
                "Significantly above team average.",
                "low",
                f"Replicate '{name}' sales approach across the team as a best practice.",
                {"person": name, "revenue": round(val, 2)},
            ))
        if not outliers_low.empty:
            name = str(outliers_low.idxmin())
            val = float(outliers_low.min())
            alerts.append(_alert(
                "risk", "Underperforming Salesperson",
                f"Salesperson '{name}' shows unusually low {rev_col} ({val:,.0f}). "
                "Significantly below team average.",
                "medium",
                f"Provide coaching or investigate obstacles for '{name}'.",
                {"person": name, "revenue": round(val, 2)},
            ))
    except Exception:
        pass
    return alerts


def _detect_product_concentration(
    df: pd.DataFrame, rev_col: str | None, product_col: str | None
) -> list[dict]:
    alerts = []
    if not rev_col or not product_col:
        return alerts
    try:
        vals = _num(df, rev_col)
        temp = pd.DataFrame({"_val": vals, "_prod": df[product_col]}).dropna()
        by_prod = temp.groupby("_prod")["_val"].sum()
        if len(by_prod) < 2:
            return alerts
        top_prod = by_prod.idxmax()
        top_share = float(by_prod.max() / by_prod.sum() * 100)
        if top_share > 50:
            sev = "high" if top_share > 70 else "medium"
            alerts.append(_alert(
                "risk", "Product Revenue Concentration",
                f"Product '{top_prod}' drives {top_share:.1f}% of total {rev_col}. "
                "Over-dependence creates business risk.",
                sev,
                "Diversify product portfolio. Invest in developing other high-margin products.",
                {"product": str(top_prod), "share_pct": round(top_share, 1)},
            ))
    except Exception:
        pass
    return alerts


# ── Main Entry Point ──────────────────────────────────────────────────────────

def generate_alerts(df: pd.DataFrame) -> list[dict]:
    """Run all alert detectors and return a deduplicated alert list."""
    rev_col = _find_col(df, _REVENUE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    date_col = _find_col(df, _DATE_SYNS)
    region_col = _find_col(df, _REGION_SYNS)
    salesman_col = _find_col(df, _SALESMAN_SYNS)
    product_col = _find_col(df, _PRODUCT_SYNS)

    alerts: list[dict] = []
    alerts.extend(_detect_revenue_drop(df, rev_col, date_col))
    alerts.extend(_detect_inventory_risk(df, qty_col, product_col))
    alerts.extend(_detect_region_underperformance(df, rev_col, region_col))
    alerts.extend(_detect_missing_data_spike(df))
    alerts.extend(_detect_salesperson_anomaly(df, rev_col, salesman_col))
    alerts.extend(_detect_product_concentration(df, rev_col, product_col))

    # Sort: high → medium → low, risk before warning before opportunity
    _sev_order = {"high": 0, "medium": 1, "low": 2}
    _type_order = {"risk": 0, "warning": 1, "opportunity": 2}
    alerts.sort(key=lambda a: (
        _sev_order.get(a["severity"], 9),
        _type_order.get(a["type"], 9),
    ))
    return alerts
