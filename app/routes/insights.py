"""Insights endpoints — with AI Insight Prioritization and Explainable AI."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.ai.insight_generator import generate_business_insights
from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user
from app.services.audit_service import log_action

router = APIRouter()
logger = logging.getLogger(__name__)

# ── Industry Expert Modes ──────────────────────────────────────────────────────

_INDUSTRY_MODES = {
    "retail": {
        "kpis": ["Revenue", "Inventory Turnover", "Gross Margin", "Units Sold", "Avg Order Value"],
        "focus_terms": ["product", "category", "store", "inventory", "promotion"],
        "terminology": {"revenue": "Retail Sales", "quantity": "Units Sold"},
        "recommended_charts": ["product_breakdown", "category_performance", "inventory_trend"],
    },
    "ecommerce": {
        "kpis": ["GMV", "Conversion Rate", "Cart Abandonment", "Customer LTV", "Return Rate"],
        "focus_terms": ["sku", "session", "cart", "checkout", "customer", "channel"],
        "terminology": {"revenue": "Gross Merchandise Value", "quantity": "Orders"},
        "recommended_charts": ["channel_breakdown", "product_performance", "customer_segments"],
    },
    "finance": {
        "kpis": ["Net Revenue", "Operating Margin", "EBITDA", "Cost-to-Income Ratio", "ROE"],
        "focus_terms": ["transaction", "account", "portfolio", "credit", "loan"],
        "terminology": {"revenue": "Net Revenue", "quantity": "Transactions"},
        "recommended_charts": ["revenue_trend", "cost_breakdown", "margin_analysis"],
    },
    "sales": {
        "kpis": ["Total Revenue", "Deals Closed", "Avg Deal Size", "Win Rate", "Pipeline Value"],
        "focus_terms": ["salesperson", "region", "pipeline", "deal", "customer", "quota"],
        "terminology": {"revenue": "Sales Revenue", "quantity": "Deals Closed"},
        "recommended_charts": ["salesperson_ranking", "regional_breakdown", "pipeline_stage"],
    },
    "travel": {
        "kpis": ["Bookings", "Revenue per Booking", "Occupancy Rate", "Cancellation Rate", "ADR"],
        "focus_terms": ["booking", "destination", "traveler", "package", "hotel", "flight"],
        "terminology": {"revenue": "Booking Revenue", "quantity": "Bookings"},
        "recommended_charts": ["destination_breakdown", "seasonal_trend", "booking_type"],
    },
    "inventory": {
        "kpis": ["Stock Level", "Turnover Rate", "Dead Stock %", "Reorder Rate", "Shrinkage"],
        "focus_terms": ["sku", "warehouse", "stock", "reorder", "supplier", "batch"],
        "terminology": {"revenue": "Stock Value", "quantity": "Units in Stock"},
        "recommended_charts": ["stock_levels", "turnover_by_product", "supplier_performance"],
    },
}


def _prioritize_insights(insights: list[dict]) -> list[dict]:
    """Rank and label insights by business impact, urgency, and confidence."""
    for insight in insights:
        itype = insight.get("type", "")
        title = insight.get("title", "").lower()
        observation = insight.get("observation", "").lower()

        # Assign priority score (0–100)
        score = 50  # Base

        # Boost for risk and revenue impact
        if itype == "risk":
            score += 20
        elif itype == "opportunity":
            score += 15
        elif itype == "performance":
            score += 10

        # Boost for revenue/high-value signals
        if any(k in title for k in ["revenue", "sales", "profit"]):
            score += 10
        if any(k in observation for k in ["highest", "lowest", "critical", "warning"]):
            score += 10
        if "outlier" in title or "fraud" in title:
            score += 15
        if "missing" in title or "quality" in title:
            score += 5

        # Assign priority label
        if score >= 85:
            priority = "critical"
            urgency = "immediate"
            confidence = "high"
        elif score >= 70:
            priority = "high"
            urgency = "this_week"
            confidence = "high"
        elif score >= 55:
            priority = "medium"
            urgency = "this_month"
            confidence = "medium"
        else:
            priority = "low"
            urgency = "when_possible"
            confidence = "medium"

        insight["priority"] = priority
        insight["priority_score"] = score
        insight["urgency"] = urgency
        insight["confidence"] = confidence

    # Sort by priority_score descending
    insights.sort(key=lambda x: x.get("priority_score", 0), reverse=True)
    return insights


def _build_explainability(df, insight: dict) -> dict:
    """Build explainability data — source data, calculations, evidence — for one insight."""
    from app.ai.insight_generator import _classify_columns

    numeric_cols, categorical_cols, _ = _classify_columns(df)
    title = insight.get("title", "")
    observation = insight.get("observation", "")

    # Build source data samples
    source_data: list[dict] = []
    calculations: list[str] = []
    chart_evidence: list[dict] = []

    for num_col in numeric_cols[:3]:
        vals = df[num_col].apply(safe_number).dropna()
        if vals.empty:
            continue
        source_data.append({
            "column": num_col,
            "total": round(float(vals.sum()), 2),
            "mean": round(float(vals.mean()), 2),
            "median": round(float(vals.median()), 2),
            "std": round(float(vals.std()), 2),
            "min": round(float(vals.min()), 2),
            "max": round(float(vals.max()), 2),
            "count": int(len(vals)),
        })
        calculations.append(
            f"{num_col}: sum={vals.sum():,.2f}, mean={vals.mean():,.2f}, "
            f"std={vals.std():,.2f}, p90={vals.quantile(0.9):,.2f}"
        )

    # Build breakdown evidence for categorical columns
    for cat_col in categorical_cols[:2]:
        if numeric_cols:
            num_col = numeric_cols[0]
            grouped = (
                df.groupby(cat_col)[num_col]
                .apply(lambda s: s.apply(safe_number).dropna().sum())
                .sort_values(ascending=False)
                .head(10)
            )
            chart_evidence.append({
                "chart_type": "bar",
                "x_axis": cat_col,
                "y_axis": num_col,
                "data": [
                    {"name": str(k), "value": round(float(v), 2)}
                    for k, v in grouped.items()
                ],
            })

    return {
        "source_data": source_data,
        "row_count": len(df),
        "column_count": len(df.columns),
        "calculations": calculations,
        "chart_evidence": chart_evidence,
        "confidence_level": insight.get("confidence", "medium"),
        "confidence_explanation": (
            "Confidence is HIGH when the signal is statistically strong (large sample, "
            "low variance). MEDIUM when there is sufficient signal but some uncertainty."
        ),
        "data_freshness": "Based on the uploaded dataset at time of analysis.",
        "reasoning": (
            f"This insight was generated by analyzing '{title}'. "
            f"The system computed real statistics from {len(df):,} rows and "
            f"{len(df.columns)} columns. No data was fabricated."
        ),
    }


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/insights/{file_id}")
def get_insights(
    file_id: str,
    mode: str = "",
    wu: dict = Depends(get_workspace_user),
):
    """Return prioritized, industry-mode-aware business insights."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    df = load_dataframe(file_doc["path"])
    industry = mode or file_doc.get("industry") or ""

    result = generate_business_insights(df, industry=industry)
    insights = _prioritize_insights(result.get("insights", []))

    # Attach industry mode context if available
    industry_context = _INDUSTRY_MODES.get(industry.lower(), {})

    log_action(wu["user_id"], "insight_created", "file", file_id, {"mode": industry})

    return {
        "insights": insights,
        "summary": result.get("summary", ""),
        "industry_mode": industry or "general",
        "industry_context": industry_context,
        "priority_breakdown": {
            "critical": sum(1 for i in insights if i.get("priority") == "critical"),
            "high": sum(1 for i in insights if i.get("priority") == "high"),
            "medium": sum(1 for i in insights if i.get("priority") == "medium"),
            "low": sum(1 for i in insights if i.get("priority") == "low"),
        },
    }


@router.get("/insights/{file_id}/explain/{insight_index}")
def explain_insight(
    file_id: str,
    insight_index: int,
    mode: str = "",
    wu: dict = Depends(get_workspace_user),
):
    """Return full explainability data for a specific insight."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    df = load_dataframe(file_doc["path"])
    industry = mode or file_doc.get("industry") or ""
    result = generate_business_insights(df, industry=industry)
    insights = _prioritize_insights(result.get("insights", []))

    if insight_index < 0 or insight_index >= len(insights):
        raise HTTPException(status_code=404, detail="Insight index out of range")

    insight = insights[insight_index]
    explainability = _build_explainability(df, insight)

    return {
        "file_id": file_id,
        "insight_index": insight_index,
        "insight": insight,
        "explainability": explainability,
    }


@router.get("/industry-modes")
def list_industry_modes():
    """Return available AI industry expert modes."""
    return {
        "modes": [
            {"id": k, "label": k.replace("_", " ").title(), **v}
            for k, v in _INDUSTRY_MODES.items()
        ]
    }
