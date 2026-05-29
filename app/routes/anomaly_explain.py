"""Anomaly Explanation — AI-powered explanation of detected anomalies.

POST /anomalies/{file_id}/explain
  Body: { column, value, row_index, context }
  Returns: plain-English explanation of why this data point is anomalous.
"""
from __future__ import annotations

import logging
import os

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.openai_config import get_openai_model

from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(tags=["anomaly-explain"])
logger = logging.getLogger(__name__)


class AnomalyExplainRequest(BaseModel):
    column: str
    value: float
    row_index: int | None = None
    context: str = ""        # e.g. "region=North, product=Laptop"
    z_score: float | None = None


@router.post("/anomalies/{file_id}/explain")
async def explain_anomaly(
    file_id: str,
    body: AnomalyExplainRequest,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found.")

    df = load_dataframe(file_doc["path"])
    if body.column not in df.columns:
        raise HTTPException(status_code=422, detail=f"Column '{body.column}' not found.")

    vals = df[body.column].apply(safe_number).dropna()
    mean = float(vals.mean())
    std = float(vals.std()) if len(vals) > 1 else 0
    median = float(vals.median())
    q1, q3 = float(vals.quantile(0.25)), float(vals.quantile(0.75))
    iqr = q3 - q1
    z = (body.value - mean) / std if std > 0 else 0
    direction = "above" if body.value > mean else "below"
    sigma_desc = f"{abs(z):.1f} standard deviations {direction} the mean"

    stat_summary = (
        f"Column '{body.column}': mean={mean:,.2f}, median={median:,.2f}, "
        f"std={std:,.2f}, Q1={q1:,.2f}, Q3={q3:,.2f}, IQR={iqr:,.2f}. "
        f"Anomalous value: {body.value:,.2f} ({sigma_desc})."
    )

    # Try AI
    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            prompt = f"""You are BizInsight AI, a business data analyst specializing in anomaly detection.

**YOUR ROLE:** Explain data anomalies found in the user's business dataset.

**RESTRICTIONS:**
- ONLY analyze anomalies within the business dataset provided.
- REFUSE to answer questions unrelated to business analysis.
- Keep explanations grounded in the statistical and business context provided.

ANOMALY DETAILS:
- Column: {body.column}
- Anomalous value: {body.value:,.2f}
- {sigma_desc}
- Context: {body.context or 'No additional context'}

COLUMN STATISTICS:
{stat_summary}

DATASET INFO:
- {len(df):,} total rows, {len(df.columns)} columns
- Columns: {', '.join(df.columns[:10].tolist())}

Explain in 2-3 sentences:
1. Why this value is statistically unusual
2. What could cause this in a real business context
3. What action to take

Be specific and business-focused."""

            response = await client.chat.completions.create(
                model=get_openai_model(),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=220,
                temperature=0.2,
            )
            explanation = response.choices[0].message.content.strip()
            return {
                "column": body.column,
                "value": body.value,
                "z_score": round(z, 2),
                "direction": direction,
                "explanation": explanation,
                "stat_summary": stat_summary,
                "source": "gpt",
            }
        except Exception as exc:
            logger.warning("Anomaly explain AI failed: %s", exc)

    # Fallback
    fallback = (
        f"The value {body.value:,.2f} in '{body.column}' is {sigma_desc}. "
        f"The typical range is {mean - 2*std:,.2f} – {mean + 2*std:,.2f} (mean ± 2σ). "
        f"Investigate this record for data entry errors, unusual events, or exceptional performance."
    )
    return {
        "column": body.column,
        "value": body.value,
        "z_score": round(z, 2),
        "direction": direction,
        "explanation": fallback,
        "stat_summary": stat_summary,
        "source": "computed",
    }
