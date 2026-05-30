"""Ask Your Chart — AI explanation of a specific chart segment."""
from __future__ import annotations

import os
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.ai.openai_config import get_openai_model
from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user

router = APIRouter(tags=["chart-ai"])
logger = logging.getLogger(__name__)


class ChartExplainRequest(BaseModel):
    chart_type: str
    segment_label: str
    segment_value: float | None = None
    metric: str = ""
    context: str = ""


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

    # Build data context using the analytics engine
    from app.services.analytics_engine import (
        compute_all_column_stats, compute_category_counts,
        resolve_columns, compute_top_ranking,
    )
    cols = resolve_columns(df, f"{body.segment_label} {body.metric}")
    col_stats = compute_all_column_stats(df)
    cat_counts = compute_category_counts(df)

    context_lines = [
        f"DATASET: {len(df):,} rows × {len(df.columns)} columns",
        f"COLUMNS: {', '.join(df.columns.tolist())}",
    ]
    for col, stats in col_stats.items():
        context_lines.append(
            f"  {col}: total={stats['total']:,.2f}  mean={stats['mean']:,.2f}  "
            f"max={stats['max']:,.2f}  min={stats['min']:,.2f}"
        )
    for col, counts in cat_counts.items():
        top = ", ".join(f"{k}({v})" for k, v in list(counts.items())[:5])
        context_lines.append(f"  {col}: {top}")

    if cols["entity_col"] and cols["metric_col"]:
        try:
            ranking = compute_top_ranking(df, cols["entity_col"], cols["metric_col"], n=10)
            context_lines.append(
                f"\nTOP {cols['entity_col'].upper()} BY {cols['metric_col'].upper()}:"
            )
            for row in ranking["rows"]:
                context_lines.append(
                    f"  #{row['rank']}: {row['name']} → {row['value']:,.2f} ({row['pct_of_total']:.1f}%)"
                )
        except Exception:
            pass

    data_context = "\n".join(context_lines)

    segment_info = f"Segment: '{body.segment_label}'"
    if body.segment_value is not None:
        segment_info += f" with value {body.segment_value:,.2f}"
    if body.metric:
        segment_info += f" (metric: {body.metric})"

    api_key = os.getenv("OPENAI_API_KEY", "")
    if api_key:
        try:
            import openai
            client = openai.AsyncOpenAI(api_key=api_key)
            prompt = f"""You are BizInsight AI, a business data analyst.
Explain this specific chart segment using only the real data provided below.

CHART CLICK: {segment_info}
CHART TYPE: {body.chart_type}
{body.context}

REAL DATA:
{data_context}

Answer in 2-3 sentences:
1. What this value means in context (high/low/average)?
2. Likely driver of this performance.
3. One specific recommendation for this segment."""

            response = await client.chat.completions.create(
                model=get_openai_model(),
                messages=[{"role": "user", "content": prompt}],
                max_tokens=250,
                temperature=0.2,
            )
            return {
                "segment_label": body.segment_label,
                "segment_value": body.segment_value,
                "explanation": response.choices[0].message.content.strip(),
                "source": "gpt",
            }
        except Exception as exc:
            logger.warning("Chart AI GPT failed: %s", exc)

    # Fallback: rule-based explanation using analytics engine
    return {
        "segment_label": body.segment_label,
        "segment_value": body.segment_value,
        "explanation": _rule_based_explain(df, body, cols),
        "source": "computed",
    }


def _rule_based_explain(df, body: ChartExplainRequest, cols: dict) -> str:
    label = body.segment_label
    value = body.segment_value
    metric_col = cols.get("metric_col")
    entity_col = cols.get("entity_col")
    lines = []

    if value is not None and metric_col:
        total = float(df[metric_col].apply(safe_number).dropna().sum())
        share = value / total * 100 if total > 0 else 0
        lines.append(
            f"'{label}' contributes {share:.1f}% of total {metric_col} "
            f"({value:,.0f} of {total:,.0f})."
        )

    if entity_col and metric_col:
        try:
            mask = df[entity_col].astype(str) == str(label)
            if mask.any():
                seg_mean = float(df.loc[mask, metric_col].apply(safe_number).dropna().mean())
                all_mean = float(df[metric_col].apply(safe_number).dropna().mean())
                if all_mean > 0:
                    pct = seg_mean / all_mean * 100
                    perf = "above" if pct > 100 else "below"
                    lines.append(
                        f"This segment performs {abs(pct - 100):.0f}% {perf} the overall average."
                    )
        except Exception:
            pass

    if not lines:
        lines.append(
            f"'{label}' shows a value of {value:,.2f}."
            if value is not None
            else f"No additional context available for '{label}'."
        )

    return " ".join(lines)
