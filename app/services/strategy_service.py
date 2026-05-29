"""AI Business Strategy Generator Service.

Generates grounded strategy plans using OpenAI with computed data context.
Falls back to rule-based templates when OpenAI is unavailable.
"""
from __future__ import annotations

import json
import os

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


_TEMPLATES = {
    "profit": {
        "strategy": "Profit Optimization Strategy",
        "analysis": "Based on your data, focusing on margin improvement and cost efficiency will drive the highest return.",
        "priority_actions": [
            "Identify top 20% of customers driving 80% of revenue and create retention programs",
            "Audit cost structure against the lowest-performing product/region segments",
            "Test selective price increases on low-elasticity, high-demand items",
            "Eliminate or bundle underperforming SKUs to reduce operational overhead",
            "Reinvest freed capital into top-performing channels and salespeople",
        ],
        "expected_impact": "10–25% profit improvement over 6–12 months",
        "risks": ["Customer churn risk from price adjustments", "Quality compromise from cost reduction"],
        "timeline": "Quick wins in 1–3 months; full impact at 12 months",
        "kpis_to_monitor": ["Gross Margin %", "Customer Lifetime Value", "Cost-per-Sale", "Revenue per Employee"],
    },
    "sales": {
        "strategy": "Sales Growth Acceleration Strategy",
        "analysis": "Your data reveals growth opportunities in underserved segments and untapped top-performer insights.",
        "priority_actions": [
            "Double down on the highest-revenue region/product identified in analysis",
            "Build a coaching program using top salesperson playbooks for bottom performers",
            "Launch cross-sell/upsell campaigns for high-frequency, low-value customers",
            "Implement customer segmentation to personalize outreach by profile",
            "Set weekly pipeline KPI reviews with automated anomaly alerts",
        ],
        "expected_impact": "15–30% revenue growth over 12 months",
        "risks": ["Sales team overextension", "Market saturation in top segments"],
        "timeline": "Quick wins in 1–2 months; sustained growth at 6–12 months",
        "kpis_to_monitor": ["Monthly Revenue", "Sales Conversion Rate", "Average Deal Size", "Salesperson Performance Index"],
    },
    "risk": {
        "strategy": "Risk Reduction & Business Resilience Plan",
        "analysis": "Key risks identified include data quality issues, revenue concentration, and anomalous patterns.",
        "priority_actions": [
            "Fix data quality issues to ensure reliable decision-making",
            "Diversify revenue by expanding into the second and third best-performing segments",
            "Implement automated anomaly and fraud monitoring rules",
            "Create 30-day and 90-day early-warning KPI dashboards",
            "Establish clear escalation protocols for critical notifications",
        ],
        "expected_impact": "30–50% reduction in surprise business events over 6 months",
        "risks": ["Over-diversification spreading resources too thin", "Implementation complexity"],
        "timeline": "Controls in 1 month; full resilience framework at 6 months",
        "kpis_to_monitor": ["Data Quality Score", "Revenue Concentration Index", "Anomaly Rate", "Risk Score"],
    },
    "efficiency": {
        "strategy": "Operational Efficiency Improvement Strategy",
        "analysis": "Operational data reveals automation opportunities and process bottlenecks worth addressing.",
        "priority_actions": [
            "Automate data collection and reporting to eliminate manual work",
            "Streamline workflows in the lowest-performing operational areas",
            "Implement predictive analytics to pre-empt supply or capacity shortfalls",
            "Benchmark team performance against industry KPIs and set improvement targets",
            "Consolidate reporting dashboards to reduce decision latency",
        ],
        "expected_impact": "20–35% operational cost reduction over 12 months",
        "risks": ["Change resistance from teams", "Integration complexity with legacy systems"],
        "timeline": "Process mapping in month 1; automation rollout at 3–6 months",
        "kpis_to_monitor": ["Process Cycle Time", "Cost per Transaction", "Employee Productivity", "Error Rate"],
    },
}


def _classify_question(question: str) -> str:
    lower = question.lower()
    if any(k in lower for k in ["profit", "margin", "earnings", "cost"]):
        return "profit"
    if any(k in lower for k in ["risk", "protect", "safe", "reduce loss", "resilient"]):
        return "risk"
    if any(k in lower for k in ["efficient", "automate", "process", "productivity", "streamline"]):
        return "efficiency"
    return "sales"


def _build_data_summary(df: pd.DataFrame) -> str:
    lines = [f"DATASET: {len(df):,} rows × {len(df.columns)} columns"]
    lines.append(f"COLUMNS: {', '.join(df.columns.tolist())}")

    for col in df.select_dtypes(include="number").columns[:5]:
        vals = df[col].apply(safe_number).dropna()
        if not vals.empty and vals.nunique() > 1:
            lines.append(
                f"{col}: total={vals.sum():,.2f}, avg={vals.mean():,.2f}, "
                f"max={vals.max():,.2f}, min={vals.min():,.2f}"
            )

    for col in df.select_dtypes(include="object").columns[:4]:
        vc = df[col].value_counts().head(5)
        if not vc.empty:
            top_items = ", ".join(f"{k}({v})" for k, v in vc.items())
            lines.append(f"{col} top values: {top_items}")

    missing = df.isnull().sum()
    missing = missing[missing > 0]
    if not missing.empty:
        lines.append(f"MISSING DATA: {', '.join(f'{c}={n}' for c, n in missing.items())}")

    return "\n".join(lines)


def generate_strategy(df: pd.DataFrame, question: str) -> dict:
    """Generate an AI-grounded business strategy plan."""
    data_summary = _build_data_summary(df)
    client = _get_openai()
    category = _classify_question(question)

    if client:
        system_prompt = (
            "You are a senior business strategy consultant. "
            "Generate a concise, actionable strategy grounded ONLY in the provided real data. "
            "Never invent numbers. Respond as valid JSON with keys: "
            "strategy, analysis, priority_actions (list), expected_impact, risks (list), "
            "timeline, kpis_to_monitor (list)."
        )
        user_prompt = (
            f"Business question: {question}\n\n"
            f"Real dataset metrics:\n{data_summary}\n\n"
            "Generate a strategy plan as a JSON object."
        )
        try:
            response = client.chat.completions.create(
                model=get_openai_model(),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=900,
                response_format={"type": "json_object"},
            )
            result = json.loads(response.choices[0].message.content)
            result["source"] = "ai_generated"
            result["grounded"] = True
            result["question"] = question
            return result
        except Exception:
            pass

    # Fallback: enrich template with actual data values
    template = _TEMPLATES[category].copy()

    rev_col = next(
        (c for c in df.columns if any(k in c.lower() for k in ["revenue", "sales", "amount"])),
        None,
    )
    if rev_col:
        vals = df[rev_col].apply(safe_number).dropna()
        if not vals.empty:
            template["analysis"] = (
                f"Your dataset shows total {rev_col} of ${vals.sum():,.2f} with an average of "
                f"${vals.mean():,.2f} per transaction. {template['analysis']}"
            )

    return {
        **template,
        "source": "rule_based",
        "grounded": True,
        "question": question,
    }
