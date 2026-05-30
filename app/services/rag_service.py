"""
BizInsight AI Copilot — Compute-First RAG Service
==================================================

Architecture
------------
1. analytics_engine classifies intent and resolves columns dynamically
2. Real pandas computations run against the uploaded dataframe
3. Structured result dict (with exact numbers) is handed to GPT
4. GPT formats the answer and adds recommendations — it never invents numbers

GPT never sees a vague text summary.
GPT always receives the exact computed answer in structured form.
"""
from __future__ import annotations

import json
import os
from typing import Any

import pandas as pd

from app.ai.openai_config import get_openai_model
from app.dataframe_utils import safe_number
from app.services.analytics_engine import (
    classify_intent,
    resolve_columns,
    compute_top_ranking,
    compute_aggregation,
    compute_trend,
    compute_correlation,
    compute_anomalies,
    compute_distribution,
    compute_all_column_stats,
    compute_category_counts,
    is_ranking_followup,
    extract_rank_request,
    _numeric_cols,
    _categorical_cols,
)

_OPENAI_CLIENT = None


def _get_openai():
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            return None
        try:
            from openai import OpenAI
            _OPENAI_CLIENT = OpenAI(api_key=key)
        except Exception:
            return None
    return _OPENAI_CLIENT


# ── Compute engine ─────────────────────────────────────────────────────────────

def _run_computations(df: pd.DataFrame, question: str) -> dict[str, Any]:
    """
    Classify the question, resolve columns, run the appropriate pandas
    operation(s), and return a structured result dict.
    """
    intents = classify_intent(question)
    primary = intents[0]
    cols = resolve_columns(df, question)

    entity_col  = cols["entity_col"]
    metric_col  = cols["metric_col"]
    date_col    = cols["date_col"]
    num_cols    = cols["num_cols"]
    cat_cols    = cols["cat_cols"]

    computed: dict[str, Any] = {
        "intents":        intents,
        "entity_col":     entity_col,
        "entity_concept": cols["entity_concept"],
        "metric_col":     metric_col,
        "metric_concept": cols["metric_concept"],
        "date_col":       date_col,
        "dataset_rows":   len(df),
        "dataset_cols":   list(df.columns),
        "primary_result": None,
        "supporting":     [],
    }

    def _add_support(r):
        if r and not r.get("error"):
            computed["supporting"].append(r)

    # ── Ranking ────────────────────────────────────────────────────────────────
    if primary in ("top_ranking", "bottom_ranking") and entity_col and metric_col:
        asc = primary == "bottom_ranking"
        r = compute_top_ranking(df, entity_col, metric_col, n=10, ascending=asc)
        computed["primary_result"] = r
        # Also add aggregation for context
        _add_support(compute_aggregation(df, metric_col))

    # ── Totals / averages ──────────────────────────────────────────────────────
    elif primary in ("total_aggregation", "average_aggregation") and metric_col:
        r = compute_aggregation(df, metric_col)
        computed["primary_result"] = r
        if entity_col:
            _add_support(compute_top_ranking(df, entity_col, metric_col, n=5))

    # ── Trend ─────────────────────────────────────────────────────────────────
    elif primary == "trend_analysis" and date_col and metric_col:
        r = compute_trend(df, date_col, metric_col)
        computed["primary_result"] = r
        if entity_col:
            _add_support(compute_top_ranking(df, entity_col, metric_col, n=5))

    # ── Correlation ───────────────────────────────────────────────────────────
    elif primary == "correlation" and len(num_cols) >= 2:
        col_a = metric_col or num_cols[0]
        col_b = next((c for c in num_cols if c != col_a), num_cols[-1])
        r = compute_correlation(df, col_a, col_b)
        computed["primary_result"] = r

    # ── Anomaly ───────────────────────────────────────────────────────────────
    elif primary == "anomaly" and metric_col:
        r = compute_anomalies(df, metric_col)
        computed["primary_result"] = r
        if entity_col:
            _add_support(compute_top_ranking(df, entity_col, metric_col, n=5))

    # ── Distribution ──────────────────────────────────────────────────────────
    elif primary == "distribution" and entity_col:
        r = compute_distribution(df, entity_col, metric_col)
        computed["primary_result"] = r

    # ── General / comparison / forecast / summary ──────────────────────────────
    else:
        parts = []
        if metric_col:
            agg = compute_aggregation(df, metric_col)
            parts.append(agg)
        if entity_col and metric_col:
            parts.append(compute_top_ranking(df, entity_col, metric_col, n=5))
        if date_col and metric_col:
            parts.append(compute_trend(df, date_col, metric_col))

        if parts:
            computed["primary_result"] = parts[0]
            for p in parts[1:]:
                _add_support(p)
        else:
            # Absolute fallback: just aggregate every numeric column
            computed["primary_result"] = {
                "type": "column_stats",
                "stats": compute_all_column_stats(df),
            }

    # Always attach full column stats + category counts as background
    computed["all_column_stats"] = compute_all_column_stats(df)
    computed["category_counts"]  = compute_category_counts(df)

    return computed


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _format_result_for_prompt(computed: dict) -> str:
    """Convert the structured result dict into a human-readable block for GPT."""
    lines: list[str] = []

    lines.append(f"DATASET: {computed['dataset_rows']:,} rows × {len(computed['dataset_cols'])} columns")
    lines.append(f"COLUMNS: {', '.join(computed['dataset_cols'])}")

    pr = computed.get("primary_result")
    if pr:
        lines.append("\n=== PRIMARY COMPUTED RESULT ===")
        rtype = pr.get("type", "")

        if rtype == "top_ranking":
            asc = pr.get("ascending", False)
            label = "BOTTOM" if asc else "TOP"
            lines.append(f"{label} {pr['entity_col'].upper()} BY {pr['metric_col'].upper()} "
                         f"(total unique: {pr['unique_entities']}):")
            for row in pr.get("rows", []):
                lines.append(f"  #{row['rank']}: {row['name']} → {row['value']:,.2f}  ({row['pct_of_total']:.1f}% of total)")
            if pr.get("winner"):
                w = pr["winner"]
                lines.append(f"WINNER: {w['name']} with {w['value']:,.2f} ({w['pct_of_total']:.1f}% of total {pr['total']:,.2f})")

        elif rtype == "aggregation":
            lines.append(f"AGGREGATION FOR {pr['metric_col'].upper()} (n={pr['count']:,}):")
            lines.append(f"  Total:  {pr['total']:,.2f}")
            lines.append(f"  Mean:   {pr['mean']:,.2f}")
            lines.append(f"  Median: {pr['median']:,.2f}")
            lines.append(f"  Min:    {pr['min']:,.2f} | Max: {pr['max']:,.2f}")
            lines.append(f"  Std Dev: {pr['std']:,.2f}")

        elif rtype == "trend":
            lines.append(f"TREND: {pr.get('metric_col','?')} over {pr.get('date_col','?')}")
            lines.append(f"  Direction: {pr.get('trend_direction','?')} (avg MoM: {pr.get('avg_mom_pct','?')}%)")
            if pr.get("total_change_pct") is not None:
                lines.append(f"  Overall change: {pr['total_change_pct']:+.1f}%  (first→last period)")
            if pr.get("best_period"):
                bp = pr["best_period"]
                lines.append(f"  Best period:  {bp['period']} → {bp['value']:,.2f}")
            if pr.get("worst_period"):
                wp = pr["worst_period"]
                lines.append(f"  Worst period: {wp['period']} → {wp['value']:,.2f}")
            lines.append("  Monthly data (last 12 periods):")
            for p in pr.get("periods", [])[-12:]:
                lines.append(f"    {p['period']}: {p['value']:,.2f}")

        elif rtype == "correlation":
            lines.append(f"CORRELATION: {pr['col_a']} vs {pr['col_b']}")
            lines.append(f"  Pearson coefficient: {pr['coefficient']:.3f}  ({pr['strength']} {pr['direction']} relationship)")
            lines.append(f"  Based on {pr['n_records']:,} paired records")

        elif rtype == "anomaly":
            lines.append(f"ANOMALY DETECTION: {pr['metric_col']}")
            lines.append(f"  Mean: {pr['mean']:,.2f} | Std: {pr['std']:,.2f}")
            lines.append(f"  Outliers (Z > {pr['threshold_z']}): {pr['outlier_count']} records ({pr['outlier_pct']}%)")
            if pr.get("max_outlier"):
                lines.append(f"  Highest outlier: {pr['max_outlier']:,.2f}")

        elif rtype == "distribution":
            lines.append(f"DISTRIBUTION OF {pr['entity_col'].upper()}"
                         + (f" BY {pr['metric_col'].upper()}" if pr.get("metric_col") else "") + ":")
            for row in pr.get("rows", []):
                lines.append(f"  {row['name']}: {row['value']:,.2f} ({row['pct']:.1f}%)")

        elif rtype == "column_stats":
            lines.append("COLUMN STATISTICS:")
            for col, stats in pr.get("stats", {}).items():
                lines.append(f"  {col}: total={stats['total']:,.2f} mean={stats['mean']:,.2f} max={stats['max']:,.2f}")

    # Supporting results
    for sup in computed.get("supporting", []):
        lines.append("\n--- SUPPORTING DATA ---")
        stype = sup.get("type", "")
        if stype == "aggregation":
            lines.append(f"{sup['metric_col'].upper()}: total={sup['total']:,.2f} mean={sup['mean']:,.2f}")
        elif stype == "top_ranking":
            lines.append(f"TOP {sup['entity_col'].upper()} BY {sup['metric_col'].upper()}:")
            for row in sup.get("rows", [])[:5]:
                lines.append(f"  {row['name']}: {row['value']:,.2f}")

    # All column stats background
    all_stats = computed.get("all_column_stats", {})
    if all_stats:
        lines.append("\n--- ALL NUMERIC COLUMN STATS ---")
        for col, stats in all_stats.items():
            lines.append(f"  {col}: total={stats['total']:,.2f}  mean={stats['mean']:,.2f}  max={stats['max']:,.2f}  min={stats['min']:,.2f}")

    # Category summaries
    cats = computed.get("category_counts", {})
    if cats:
        lines.append("\n--- CATEGORICAL SUMMARIES ---")
        for col, counts in cats.items():
            top = ", ".join(f"{k}({v})" for k, v in list(counts.items())[:5])
            lines.append(f"  {col}: {top}")

    return "\n".join(lines)


# ── System prompt ──────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """You are BizInsight AI, an expert Business Intelligence analyst.

STRICT RULES:
1. You ONLY answer questions about the business data provided.
2. You NEVER invent, guess, or approximate numbers.
3. All numbers you cite MUST come from the COMPUTED RESULTS section.
4. If the exact number is in the computed results, use it. If not, say "the data does not contain this."
5. Do NOT say "the dataset does not provide enough information" unless no relevant computed result exists.

YOUR TASK for each question:
- State the direct answer using exact computed numbers.
- Briefly explain what the numbers mean in business context.
- Give ONE specific, actionable recommendation.

RESPONSE FORMAT (always use this structure):

**Answer:** [Direct answer with exact numbers from computed results]

**Insight:** [What this means for the business — 1-2 sentences]

**Recommendation:** [One specific action the business should take]

Keep the total response under 200 words. Be precise and professional."""


# ── Ranking follow-up handler ──────────────────────────────────────────────────

def _answer_ranking_followup(question: str, rank_result: dict, full_ranking: dict) -> dict:
    """Answer a positional follow-up using a cached ranking — no re-querying needed."""
    entity_col = rank_result["entity_col"]
    metric_col  = rank_result["metric_col"]
    total       = rank_result["total"]
    rows        = rank_result["rows"]
    context     = rank_result.get("context", "")

    lines: list[str] = [
        f"FOLLOW-UP RANKING QUESTION: {question}",
        f"PREVIOUS RANKING: {entity_col} ranked by {metric_col}",
        f"GRAND TOTAL {metric_col}: {total:,.2f}",
        "",
    ]

    if not rows:
        lines.append(f"NOTE: {context}")
    elif rank_result["type"] == "top_n":
        n = rank_result.get("n", len(rows))
        lines.append(f"TOP {n} {entity_col.upper()} BY {metric_col.upper()}:")
        for row in rows:
            lines.append(
                f"  #{row['rank']}: {row['name']} → {row['value']:,.2f} "
                f"({row['pct_of_total']:.1f}% of total)"
            )
    else:
        row = rows[0]
        lines.append(f"REQUESTED POSITION ({context}):")
        lines.append(
            f"  #{row['rank']}: {row['name']} → {row['value']:,.2f} "
            f"({row['pct_of_total']:.1f}% of total {total:,.2f})"
        )
        # Also show rank #1 for comparison if this isn't rank 1
        if row["rank"] > 1:
            top = full_ranking["rows"][0]
            lines.append(
                f"  FOR COMPARISON — #1: {top['name']} → {top['value']:,.2f} "
                f"({top['pct_of_total']:.1f}%)"
            )

    data_context = "\n".join(lines)

    client = _get_openai()
    if client:
        system = """You are BizInsight AI. Answer this ranking follow-up question using ONLY the computed data provided.
State the rank, name, and exact value. Compare to #1 if this isn't the top performer.
Format: **Answer:** [rank + name + value] **Context:** [% of total, gap from leader if applicable] **Recommendation:** [one action]
Keep it under 120 words."""

        user = f"""QUESTION: {question}

COMPUTED RANKING DATA (all numbers are real — use them exactly):
{data_context}"""

        try:
            resp = client.chat.completions.create(
                model=get_openai_model(),
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
                temperature=0.1,
                max_tokens=250,
            )
            return {
                "answer":         resp.choices[0].message.content.strip(),
                "grounded":       True,
                "source":         "ranking_followup",
                "ranking_result": full_ranking,
                "model":          get_openai_model(),
            }
        except Exception:
            pass

    # Fallback: plain-text answer
    if not rows:
        fallback = context
    else:
        row = rows[0]
        fallback = (
            f"#{row['rank']}: {row['name']} — {metric_col} of {row['value']:,.2f} "
            f"({row['pct_of_total']:.1f}% of total {total:,.2f})."
        )
    return {
        "answer":         fallback,
        "grounded":       True,
        "source":         "ranking_followup_computed",
        "ranking_result": full_ranking,
    }


# ── Main entry point ───────────────────────────────────────────────────────────

def answer_with_rag(df: pd.DataFrame, question: str, analysis: dict | None = None,
                    chat_history: list | None = None) -> dict:
    """
    Answer a business question grounded entirely in real computed data.

    Workflow:
    1. Run analytics_engine to compute exact answers from the dataframe
    2. Format the computed result as a structured prompt context
    3. GPT formats + adds recommendation — never invents numbers
    4. Return answer with full metadata for the UI
    """
    # Step 0: Check for ranking follow-up before doing any computation
    if chat_history and is_ranking_followup(question):
        # Walk history newest-first to find the last stored ranking
        for msg in reversed(chat_history):
            if msg.get("role") == "assistant" and msg.get("ranking_result"):
                full_ranking = msg["ranking_result"]
                rank_result  = extract_rank_request(question, full_ranking)
                if rank_result is not None:
                    return _answer_ranking_followup(question, rank_result, full_ranking)
                # Follow-up detected but can't resolve position — fall through to normal flow
                break

    # Step 1: Compute the real answer
    computed = _run_computations(df, question)

    # Step 2: Format computed result for GPT
    data_context = _format_result_for_prompt(computed)

    client = _get_openai()

    # Step 3: No OpenAI — return formatted computed data directly
    if client is None:
        primary = computed.get("primary_result", {})
        fallback_lines = [f"AI explanation unavailable. Here are the real computed results:\n"]
        fallback_lines.append(data_context)
        return {
            "answer":            "\n".join(fallback_lines),
            "grounded":          True,
            "source":            "computed_only",
            "intents":           computed["intents"],
            "entity_col":        computed["entity_col"],
            "metric_col":        computed["metric_col"],
            "primary_result":    primary,
        }

    # Step 4: Ask GPT to format the result
    user_prompt = f"""QUESTION: {question}

COMPUTED RESULTS (100% real data — use ONLY these numbers):
{data_context}

Format the answer using the required structure. Use exact numbers from the computed results above."""

    try:
        response = client.chat.completions.create(
            model=get_openai_model(),
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.1,
            max_tokens=450,
        )
        ai_answer = response.choices[0].message.content.strip()
        pr = computed.get("primary_result") or {}
        return {
            "answer":         ai_answer,
            "grounded":       True,
            "source":         "rag_openai",
            "model":          get_openai_model(),
            "intents":        computed["intents"],
            "entity_col":     computed["entity_col"],
            "metric_col":     computed["metric_col"],
            "primary_result": pr,
            # Persist ranking so follow-up questions can reuse it
            "ranking_result": pr if pr.get("type") == "top_ranking" else None,
        }
    except Exception as exc:
        # Fallback: return computed data without GPT formatting
        return {
            "answer":   f"GPT unavailable. Computed answer:\n\n{data_context}",
            "grounded": True,
            "source":   "computed_fallback",
            "error":    str(exc),
            "intents":  computed["intents"],
        }
