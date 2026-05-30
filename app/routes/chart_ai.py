"""Ask Your Chart — AI explanation of a specific chart segment.

POST /ai-chat/{file_id}/chart-explain
  Body: { chart_type, segment_label, segment_value, metric, context }
  Returns: focused AI explanation of why that segment looks the way it does.
"""
from __future__ import annotations

import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.openai_config import get_openai_model

from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_workspace_user
from app.services.rag_service import _build_data_context, _find_col, _num, _REVENUE_SYNS, _REGION_SYNS, _PRODUCT_SYNS
from app.storage import get_file_record_for_user

router = APIRouter(tags=["chart-ai"])
logger = logging.getLogger(__name__)


class ChartExplainRequest(BaseModel):
    chart_type: str          # "bar" | "pie" | "line" | "distribution"
    segment_label: str       # e.g. "North" or "Laptop Pro"
    segment_value: float | None = None
    metric: str = ""         # e.g. "revenue"
    context: str = ""        # optional additional context from frontend


@router.post("/ai-chat/{file_id}/chart-explain")
async def chart_explain(
    file_id: str,
    body: ChartExplainRequest,
    wu: dict = Depends(get_workspace_user),
):
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    df = load_dataframe(file_doc["path"])

    # Build focused context around the segment
    data_context = _build_data_context(df)

    segment_info = f"Segment: '{body.segment_label}'"
    if body.segment_value is not None:
        segment_info += f" with value {body.segment_value:,.2f}"
    if body.metric:
        segment_info += f" (metric: {body.metric})"

    question = (
        f"Explain this chart insight: {segment_info}. "
        f"Chart type: {body.chart_type}. "
        f"{body.context}"
    ).strip()

    # Try AI first
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            prompt = f"""You are BizInsight AI, a business data analyst.

**YOUR ROLE:** Explain specific data points and business insights from the provided chart data.

**RESTRICTIONS:**
- ONLY answer questions about the chart segment and business dataset provided.
- REFUSE non-business questions.
- If the question is unrelated to business or the data, respond: "I can only explain insights related to your business data."

CHART CLICK: {segment_info}
CHART TYPE: {body.chart_type}

FULL DATA CONTEXT:
{data_context}

Explain in 2-3 sentences:
1. What this value means in context (is it high/low/average?)
2. What likely drives this performance
3. One specific recommendation for this segment

Be concise, specific, and business-focused."""

            response = await client.chat.completions.create(
                model=get_openai_model(),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=250,
                temperature=0.2,
            )
            answer = response.choices[0].message.content.strip()
            return {
                "segment_label": body.segment_label,
                "segment_value": body.segment_value,
                "explanation": answer,
                "source": "gpt",
            }
        except Exception as exc:
            logger.warning("Chart AI failed: %s", exc)

    # Fallback: rule-based explanation
    explanation = _rule_based_chart_explain(df, body)
    return {
        "segment_label": body.segment_label,
        "segment_value": body.segment_value,
        "explanation": explanation,
        "source": "computed",
    }


def _rule_based_chart_explain(df, body: ChartExplainRequest) -> str:
    label = body.segment_label
    value = body.segment_value

    rev_col = _find_col(df, _REVENUE_SYNS)
    region_col = _find_col(df, _REGION_SYNS)
    product_col = _find_col(df, _PRODUCT_SYNS)

    lines = []

    if value is not None and rev_col:
        total = float(_num(df, rev_col).sum())
        share = value / total * 100 if total > 0 else 0
        lines.append(f"'{label}' contributes {share:.1f}% of total {rev_col} ({value:,.0f} of {total:,.0f}).")

    if region_col and label in df[region_col].astype(str).values and rev_col:
        mask = df[region_col].astype(str) == label
        region_vals = _num(df[mask], rev_col)
        all_vals = _num(df, rev_col)
        pct = float(region_vals.mean() / all_vals.mean() * 100) if all_vals.mean() > 0 else 0
        perf = "above" if pct > 100 else "below"
        lines.append(f"This region performs {abs(pct-100):.0f}% {perf} the overall average.")

    if not lines:
        lines.append(f"'{label}' shows a value of {value:,.2f}." if value else f"No additional context available for '{label}'.")

    return " ".join(lines)
