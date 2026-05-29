"""AI Business Monitor.

Continuously watches business performance and generates proactive insights.
Combines KPIs, trend analysis, alerts, and forecasting into a single pulse.
Falls back to a rule-based summary when OpenAI is unavailable.
"""
from __future__ import annotations

import os
import logging
from typing import Any

from app.ai.openai_config import get_openai_model

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number
from app.monitoring.alert_engine import generate_alerts, _find_col, _num
from app.monitoring.alert_engine import _REVENUE_SYNS, _DATE_SYNS, _REGION_SYNS, _PRODUCT_SYNS

logger = logging.getLogger(__name__)
_OPENAI_KEY = os.getenv("OPENAI_API_KEY", "")


# ── KPI snapshot ──────────────────────────────────────────────────────────────

def _build_kpi_snapshot(df: pd.DataFrame) -> dict:
    rev_col = _find_col(df, _REVENUE_SYNS)
    date_col = _find_col(df, _DATE_SYNS)
    region_col = _find_col(df, _REGION_SYNS)
    product_col = _find_col(df, _PRODUCT_SYNS)

    snapshot: dict[str, Any] = {"rows": len(df), "columns": list(df.columns)}

    if rev_col:
        vals = _num(df, rev_col)
        snapshot["total_revenue"] = round(float(vals.sum()), 2)
        snapshot["avg_revenue"] = round(float(vals.mean()), 2)
        snapshot["revenue_column"] = rev_col

        if date_col:
            try:
                dates = pd.to_datetime(df[date_col], errors="coerce")
                temp = pd.DataFrame({"_val": vals, "_date": dates}).dropna()
                temp["_period"] = temp["_date"].dt.to_period("M")
                monthly = temp.groupby("_period")["_val"].sum().sort_index()
                if len(monthly) >= 3:
                    last = float(monthly.iloc[-1])
                    prev = float(monthly.iloc[-2])
                    pct = ((last - prev) / abs(prev) * 100) if prev != 0 else 0
                    snapshot["mom_growth_pct"] = round(pct, 2)
                    snapshot["trend"] = "up" if pct > 0 else "down" if pct < 0 else "flat"
                    snapshot["periods_analyzed"] = len(monthly)
            except Exception:
                pass

    if region_col and rev_col:
        try:
            vals = _num(df, rev_col)
            temp = pd.DataFrame({"_val": vals, "_region": df[region_col]}).dropna()
            by_region = temp.groupby("_region")["_val"].sum()
            snapshot["top_region"] = str(by_region.idxmax())
            snapshot["region_count"] = int(by_region.nunique())
        except Exception:
            pass

    if product_col and rev_col:
        try:
            vals = _num(df, rev_col)
            temp = pd.DataFrame({"_val": vals, "_prod": df[product_col]}).dropna()
            by_prod = temp.groupby("_prod")["_val"].sum()
            snapshot["top_product"] = str(by_prod.idxmax())
            snapshot["product_count"] = int(by_prod.nunique())
            snapshot["top_product_share_pct"] = round(
                float(by_prod.max() / by_prod.sum() * 100), 1
            )
        except Exception:
            pass

    return snapshot


def _compute_pulse(alerts: list[dict], kpis: dict) -> str:
    """Determine overall business pulse from alerts and KPI trends."""
    high_risk = sum(1 for a in alerts if a["type"] == "risk" and a["severity"] == "high")
    medium_risk = sum(1 for a in alerts if a["type"] == "risk" and a["severity"] == "medium")
    opportunities = sum(1 for a in alerts if a["type"] == "opportunity")
    trend = kpis.get("trend", "flat")
    mom_growth = kpis.get("mom_growth_pct", 0)

    if high_risk >= 2 or (high_risk >= 1 and trend == "down"):
        return "negative"
    if high_risk == 0 and medium_risk <= 1 and (trend == "up" or mom_growth > 5):
        return "positive"
    return "stable"


def _rule_based_summary(kpis: dict, alerts: list[dict]) -> dict:
    """Generate a business monitor response without AI."""
    pulse = _compute_pulse(alerts, kpis)

    total = kpis.get("total_revenue")
    mom = kpis.get("mom_growth_pct")
    top_region = kpis.get("top_region")
    top_product = kpis.get("top_product")
    top_product_share = kpis.get("top_product_share_pct")

    lines = []
    if total:
        lines.append(f"Total {kpis.get('revenue_column', 'revenue')}: {total:,.0f}.")
    if mom is not None:
        direction = "grew" if mom > 0 else "declined"
        lines.append(f"Revenue {direction} {abs(mom):.1f}% month-over-month.")
    if top_region:
        lines.append(f"Top performing region: {top_region}.")
    if top_product and top_product_share:
        lines.append(
            f"'{top_product}' drives {top_product_share:.1f}% of revenue."
        )

    high_alerts = [a for a in alerts if a["severity"] == "high"]
    if high_alerts:
        lines.append(f"{len(high_alerts)} critical issue(s) require immediate attention.")

    summary = " ".join(lines) if lines else "Business data analyzed. Review alerts for actionable insights."

    recommendations = []
    for alert in alerts[:4]:
        recommendations.append(alert["recommended_action"])

    if not recommendations:
        recommendations = [
            "Continue monitoring KPIs for emerging trends.",
            "Review your data regularly to stay ahead of market changes.",
        ]

    return {
        "pulse": pulse,
        "summary": summary,
        "recommendations": recommendations[:5],
        "kpi_snapshot": kpis,
        "alert_count": len(alerts),
        "source": "rule_based",
    }


async def _ai_summary(kpis: dict, alerts: list[dict]) -> dict | None:
    """Use GPT to generate a narrative business summary."""
    if not _OPENAI_KEY:
        return None
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=_OPENAI_KEY)

        kpi_text = "\n".join(f"- {k}: {v}" for k, v in kpis.items() if not isinstance(v, list))
        alert_text = "\n".join(
            f"- [{a['severity'].upper()}] {a['title']}: {a['message']}"
            for a in alerts[:6]
        )
        prompt = f"""You are a senior business intelligence analyst.
Analyze these business KPIs and alerts, then produce:
1. A one-sentence business pulse (positive / stable / negative)
2. A 2-3 sentence executive summary
3. 3-5 specific, actionable recommendations

KPIs:
{kpi_text or 'No KPI data available.'}

Alerts:
{alert_text or 'No alerts detected.'}

Respond ONLY as valid JSON:
{{
  "pulse": "positive|stable|negative",
  "summary": "...",
  "recommendations": ["...", "...", "..."]
}}"""

        response = await client.chat.completions.create(
            model=get_openai_model(),
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.3,
        )
        import json
        content = response.choices[0].message.content or "{}"
        # Strip markdown code fences if present
        content = content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        parsed = json.loads(content)
        pulse = parsed.get("pulse", _compute_pulse(alerts, kpis))
        return {
            "pulse": pulse,
            "summary": parsed.get("summary", ""),
            "recommendations": parsed.get("recommendations", []),
            "kpi_snapshot": kpis,
            "alert_count": len(alerts),
            "source": "gpt",
        }
    except Exception as exc:
        logger.warning("AI monitor GPT call failed: %s", exc)
        return None


async def run_business_monitor(df: pd.DataFrame) -> dict:
    """Main entry point: analyze df and return business pulse."""
    kpis = _build_kpi_snapshot(df)
    alerts = generate_alerts(df)

    ai_result = await _ai_summary(kpis, alerts)
    if ai_result:
        ai_result["kpi_snapshot"] = kpis
        ai_result["alert_count"] = len(alerts)
        return ai_result

    return _rule_based_summary(kpis, alerts)
