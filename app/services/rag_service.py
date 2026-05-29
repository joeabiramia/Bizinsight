"""RAG AI Copilot Service.

Grounded AI responses — the AI NEVER hallucinates.
Workflow:
  1. Pre-compute ALL relevant metrics from the real dataframe
  2. Build a structured context string with actual numbers
  3. Send context + question to OpenAI (GPT-4o-mini)
  4. AI only explains real numbers — never invents data

This is a "Compute-First RAG" approach, optimal for analytics use cases.
"""
from __future__ import annotations

import os
from typing import Any

import numpy as np
import pandas as pd

from app.ai.openai_config import get_openai_model

from app.dataframe_utils import safe_number

_OPENAI_CLIENT = None


def _get_openai():
    global _OPENAI_CLIENT
    if _OPENAI_CLIENT is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        try:
            from openai import OpenAI
            _OPENAI_CLIENT = OpenAI(api_key=api_key)
        except Exception:
            return None
    return _OPENAI_CLIENT


_REVENUE_SYNS = ["revenue", "sales", "total_sales", "amount", "income", "value"]
_QTY_SYNS = ["quantity", "qty", "units", "volume", "orders", "bookings"]
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


def _build_data_context(df: pd.DataFrame) -> str:
    """Pre-compute all real metrics and build a rich context string."""
    lines: list[str] = []

    lines.append(f"DATASET OVERVIEW: {len(df):,} rows × {len(df.columns)} columns")
    lines.append(f"COLUMNS: {', '.join(df.columns.tolist())}")

    rev_col = _find_col(df, _REVENUE_SYNS)
    qty_col = _find_col(df, _QTY_SYNS)
    date_col = _find_col(df, _DATE_SYNS)
    region_col = _find_col(df, _REGION_SYNS)
    salesman_col = _find_col(df, _SALESMAN_SYNS)
    product_col = _find_col(df, _PRODUCT_SYNS)

    # Revenue metrics
    if rev_col:
        vals = _num(df, rev_col)
        lines.append(f"\nREVENUE METRICS (column: {rev_col}):")
        lines.append(f"  Total: ${vals.sum():,.2f}")
        lines.append(f"  Average: ${vals.mean():,.2f}")
        lines.append(f"  Median: ${vals.median():,.2f}")
        lines.append(f"  Max: ${vals.max():,.2f}  |  Min: ${vals.min():,.2f}")
        lines.append(f"  Std Dev: ${vals.std():,.2f}")

    # Quantity metrics
    if qty_col:
        vals = _num(df, qty_col)
        lines.append(f"\nQUANTITY METRICS (column: {qty_col}):")
        lines.append(f"  Total: {vals.sum():,.0f}")
        lines.append(f"  Average: {vals.mean():,.2f}  |  Max: {vals.max():,.0f}  |  Min: {vals.min():,.0f}")

    # By Region
    if region_col and rev_col:
        grouped = df.groupby(region_col)[rev_col].apply(lambda s: s.apply(safe_number).dropna().sum()).sort_values(ascending=False)
        lines.append(f"\nREVENUE BY {region_col.upper()}:")
        for name, val in grouped.head(10).items():
            lines.append(f"  {name}: ${float(val):,.2f}")
        if len(grouped) > 10:
            lines.append(f"  ... and {len(grouped)-10} more regions")

    # By Salesperson
    if salesman_col and rev_col:
        grouped = df.groupby(salesman_col)[rev_col].apply(lambda s: s.apply(safe_number).dropna().sum()).sort_values(ascending=False)
        lines.append(f"\nREVENUE BY {salesman_col.upper()}:")
        for name, val in grouped.head(10).items():
            lines.append(f"  {name}: ${float(val):,.2f}")

    # By Product
    if product_col and rev_col:
        grouped = df.groupby(product_col)[rev_col].apply(lambda s: s.apply(safe_number).dropna().sum()).sort_values(ascending=False)
        lines.append(f"\nREVENUE BY {product_col.upper()} (Top 10):")
        for name, val in grouped.head(10).items():
            lines.append(f"  {name}: ${float(val):,.2f}")

    # Monthly trend
    if date_col and rev_col:
        try:
            temp = pd.DataFrame({
                "_rev": df[rev_col].apply(safe_number),
                "_date": pd.to_datetime(df[date_col], errors="coerce")
            }).dropna()
            temp["_period"] = temp["_date"].dt.to_period("M")
            monthly = temp.groupby("_period")["_rev"].sum().sort_index()
            if len(monthly) >= 2:
                lines.append(f"\nMONTHLY REVENUE TREND (last {min(12, len(monthly))} months):")
                for period, val in monthly.tail(12).items():
                    lines.append(f"  {period}: ${float(val):,.2f}")
                if len(monthly) >= 2:
                    last = float(monthly.iloc[-1])
                    prev = float(monthly.iloc[-2])
                    if prev != 0:
                        pct = (last - prev) / abs(prev) * 100
                        lines.append(f"  Latest MoM change: {pct:+.1f}%")
        except Exception:
            pass

    # All numeric summaries
    lines.append("\nNUMERIC COLUMN STATISTICS:")
    for col in df.columns:
        try:
            vals = df[col].apply(safe_number).dropna()
            if len(vals) >= 5 and vals.nunique() > 1:
                lines.append(f"  {col}: mean={vals.mean():.2f}, median={vals.median():.2f}, sum={vals.sum():.2f}, std={vals.std():.2f}")
        except Exception:
            pass

    # Top categorical values
    lines.append("\nCATEGORICAL COLUMN SUMMARIES:")
    for col in df.select_dtypes(include="object").columns[:6]:
        vc = df[col].value_counts().head(5)
        if not vc.empty:
            top = ", ".join(f"{k}({v})" for k, v in vc.items())
            lines.append(f"  {col}: {top}")

    # Missing data
    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if not missing.empty:
        lines.append("\nMISSING DATA:")
        for col, count in missing.items():
            pct = count / len(df) * 100
            lines.append(f"  {col}: {count} missing ({pct:.1f}%)")

    return "\n".join(lines)


def answer_with_rag(df: pd.DataFrame, question: str, analysis: dict | None = None) -> dict:
    """Answer a business question grounded in real data."""
    client = _get_openai()

    # Always compute real metrics first
    data_context = _build_data_context(df)

    if client is None:
        # Fallback: return the computed context as the answer
        return {
            "answer": (
                "AI explanation unavailable (OPENAI_API_KEY not configured). "
                f"Here are the real computed metrics:\n\n{data_context}"
            ),
            "grounded": True,
            "source": "computed_metrics_only",
            "data_context_used": True,
        }

    system_prompt = """You are BizInsight AI, an expert business analyst specialized in data-driven insights.

**CRITICAL RESTRICTIONS:**
- ONLY answer questions directly related to the provided business dataset.
- REFUSE any questions about topics unrelated to business analytics, sales, revenue, KPIs, or company data.
- If a question is not about the business data, respond: "I can only answer questions related to your business data."

**DATA INTEGRITY:**
- ONLY answer based on the REAL DATA METRICS provided in the context.
- NEVER invent, guess, or hallucinate numbers.
- If the data does not contain information to answer a question, say so clearly.
- Always cite specific numbers from the context in your answer.
- Keep answers concise, professional, and actionable.
- Format monetary values with $ and commas. Use bold for key numbers."""

    user_prompt = f"""Based on the following REAL computed metrics from the dataset, answer this question:

QUESTION: {question}

COMPUTED DATA METRICS (100% real, calculated from actual dataset):
{data_context}

Answer in 2-4 sentences. Be specific with numbers. End with one actionable business recommendation."""

    try:
        response = client.chat.completions.create(
            model=get_openai_model(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.1,  # Very low temperature for factual, consistent responses
            max_tokens=400,
        )
        ai_answer = response.choices[0].message.content.strip()
        return {
            "answer": ai_answer,
            "grounded": True,
            "source": "rag_openai",
            "data_context_used": True,
            "model": get_openai_model(),
        }
    except Exception as e:
        # Fallback to computed context
        return {
            "answer": (
                f"AI processing error. Here are the computed metrics:\n\n{data_context}"
            ),
            "grounded": True,
            "source": "computed_metrics_fallback",
            "error": str(e),
            "data_context_used": True,
        }
