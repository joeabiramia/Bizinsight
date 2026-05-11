from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import pandas as pd

from app.ai.insight_generator import generate_insights
from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter()


class Question(BaseModel):
    question: str


# ── Column synonym lists (priority-ordered: earlier = higher priority) ────────

_SALESMAN_SYNS = [
    "salesman", "salesperson", "sales_rep", "salesrep",
    "agent", "employee", "seller", "rep", "owner",
]
_REVENUE_SYNS = [
    "revenue", "sales", "total_sales", "totalsales",
    "amount", "income", "value", "price",
]
_PRODUCT_SYNS = ["product", "item", "sku", "category"]
_REGION_SYNS = ["region", "territory", "area", "country", "state", "city", "zone", "district"]
_QUANTITY_SYNS = ["quantity", "qty", "units", "volume"]


def _normalize(name: str) -> str:
    return str(name).lower().replace(" ", "_").replace("-", "_")


def find_column_by_synonyms(df: pd.DataFrame, synonyms: list) -> str | None:
    """Iterate synonyms in priority order; return the first matching column."""
    for syn in synonyms:
        for col in df.columns:
            if syn in _normalize(col):
                return col
    return None


def _is_best_intent(lower: str) -> bool:
    return any(k in lower for k in [
        "best", "top", "highest", "most", "leading", "maximum", "max",
    ])


def _is_worst_intent(lower: str) -> bool:
    return any(k in lower for k in [
        "worst", "lowest", "least", "bottom", "minimum", "min",
        "poorest", "weakest", "underperform", "low performing",
        "lowest performing", "least performing",
    ])


# ── Aggregation helpers ───────────────────────────────────────────────────────

def _parse_numeric(series: pd.Series) -> pd.Series:
    return series.apply(safe_number).fillna(0)


def _top_entry(df: pd.DataFrame, group_col: str, value_col: str):
    if not group_col or not value_col:
        return None
    if group_col not in df.columns or value_col not in df.columns:
        return None
    temp = df[[group_col, value_col]].copy()
    temp["_v"] = _parse_numeric(temp[value_col])
    grouped = temp.groupby(group_col, dropna=False)["_v"].sum().reset_index()
    if grouped.empty:
        return None
    row = grouped.sort_values("_v", ascending=False).iloc[0]
    label = "Unknown" if pd.isna(row[group_col]) else str(row[group_col])
    return label, float(row["_v"])


def _bottom_entry(df: pd.DataFrame, group_col: str, value_col: str):
    if not group_col or not value_col:
        return None
    if group_col not in df.columns or value_col not in df.columns:
        return None
    temp = df[[group_col, value_col]].copy()
    temp["_v"] = _parse_numeric(temp[value_col])
    grouped = temp.groupby(group_col, dropna=False)["_v"].sum().reset_index()
    if grouped.empty:
        return None
    row = grouped.sort_values("_v", ascending=True).iloc[0]
    label = "Unknown" if pd.isna(row[group_col]) else str(row[group_col])
    return label, float(row["_v"])


def _total(df: pd.DataFrame, value_col: str):
    if not value_col or value_col not in df.columns:
        return None
    return float(_parse_numeric(df[value_col]).sum())


def _average(df: pd.DataFrame, value_col: str):
    if not value_col or value_col not in df.columns:
        return None
    vals = df[value_col].apply(safe_number).dropna()
    return float(vals.mean()) if not vals.empty else None


def _max_val(df: pd.DataFrame, value_col: str):
    if not value_col or value_col not in df.columns:
        return None
    vals = df[value_col].apply(safe_number).dropna()
    return float(vals.max()) if not vals.empty else None


# ── Main intent router ────────────────────────────────────────────────────────

def answer_business_question(df: pd.DataFrame, question: str) -> dict | None:
    lower = question.lower()

    revenue_col = find_column_by_synonyms(df, _REVENUE_SYNS)
    quantity_col = find_column_by_synonyms(df, _QUANTITY_SYNS)
    product_col = find_column_by_synonyms(df, _PRODUCT_SYNS)
    region_col = find_column_by_synonyms(df, _REGION_SYNS)
    salesman_col = find_column_by_synonyms(df, _SALESMAN_SYNS)

    is_best = _is_best_intent(lower)
    is_worst = _is_worst_intent(lower)

    # ── Row / column meta ────────────────────────────────────────────────────
    if any(k in lower for k in [
        "how many rows", "how many records", "row count", "record count", "size of dataset",
    ]):
        return {
            "answer": f"The dataset contains {len(df):,} rows and {len(df.columns)} columns.",
            "intent": "row_count",
        }

    if any(k in lower for k in ["what columns", "list columns", "column names", "what fields"]):
        return {
            "answer": f"The dataset has {len(df.columns)} columns: {', '.join(str(c) for c in df.columns)}.",
            "intent": "column_list",
        }

    # ── List unique values ────────────────────────────────────────────────────
    if any(k in lower for k in ["list all", "show all", "all unique", "unique values"]):
        if region_col and any(k in lower for k in ["region", "territory", "area"]):
            unique_vals = df[region_col].dropna().unique().tolist()
            return {
                "answer": f"All regions: {', '.join(str(v) for v in unique_vals)}.",
                "intent": "list_unique",
                "dimension_column": region_col,
            }
        if product_col and any(k in lower for k in ["product", "item"]):
            unique_vals = df[product_col].dropna().unique().tolist()
            return {
                "answer": f"All products: {', '.join(str(v) for v in unique_vals)}.",
                "intent": "list_unique",
                "dimension_column": product_col,
            }

    # ── Salesperson ───────────────────────────────────────────────────────────
    if any(k in lower for k in [
        "salesman", "salesperson", "sales rep", "salesrep", "sales person", "agent", "seller",
    ]):
        if salesman_col and revenue_col:
            if is_worst:
                result = _bottom_entry(df, salesman_col, revenue_col)
                if result:
                    return {
                        "answer": (
                            f"The lowest performing salesman is {result[0]} "
                            f"with total sales of ${result[1]:,.2f}."
                        ),
                        "intent": "worst_salesman",
                        "dimension_column": salesman_col,
                        "metric_column": revenue_col,
                    }
            else:
                result = _top_entry(df, salesman_col, revenue_col)
                if result:
                    return {
                        "answer": (
                            f"The best performing salesman is {result[0]} "
                            f"with total sales of ${result[1]:,.2f}."
                        ),
                        "intent": "best_salesman",
                        "dimension_column": salesman_col,
                        "metric_column": revenue_col,
                    }

    # ── Region ────────────────────────────────────────────────────────────────
    if any(k in lower for k in ["region", "territory", "area", "zone", "district"]):
        if region_col:
            # "list all regions" — no best/worst qualifier
            if any(k in lower for k in ["list", "all", "show"]) and not is_best and not is_worst:
                unique_vals = df[region_col].dropna().unique().tolist()
                return {
                    "answer": f"All regions: {', '.join(str(v) for v in unique_vals)}.",
                    "intent": "list_unique",
                    "dimension_column": region_col,
                }
            if revenue_col:
                if is_worst:
                    result = _bottom_entry(df, region_col, revenue_col)
                    if result:
                        return {
                            "answer": (
                                f"The lowest performing region is {result[0]} "
                                f"with total sales of ${result[1]:,.2f}."
                            ),
                            "intent": "worst_region",
                            "dimension_column": region_col,
                            "metric_column": revenue_col,
                        }
                else:
                    result = _top_entry(df, region_col, revenue_col)
                    if result:
                        return {
                            "answer": (
                                f"The top performing region is {result[0]} "
                                f"with total sales of ${result[1]:,.2f}."
                            ),
                            "intent": "best_region",
                            "dimension_column": region_col,
                            "metric_column": revenue_col,
                        }

    # ── Product ───────────────────────────────────────────────────────────────
    if any(k in lower for k in ["product", "item", "sku"]) and product_col:
        metric_col = revenue_col or quantity_col
        if metric_col:
            if is_worst:
                result = _bottom_entry(df, product_col, metric_col)
                if result:
                    return {
                        "answer": (
                            f"The worst performing product is '{result[0]}' "
                            f"with total sales of ${result[1]:,.2f}."
                        ),
                        "intent": "worst_product",
                        "dimension_column": product_col,
                        "metric_column": metric_col,
                    }
            else:
                result = _top_entry(df, product_col, metric_col)
                if result:
                    return {
                        "answer": (
                            f"The best selling product is '{result[0]}' "
                            f"with total sales of ${result[1]:,.2f}."
                        ),
                        "intent": "best_product",
                        "dimension_column": product_col,
                        "metric_column": metric_col,
                    }

    # ── Revenue / sales aggregates ────────────────────────────────────────────
    if any(k in lower for k in ["revenue", "sales", "income", "earnings"]) and revenue_col:
        if any(k in lower for k in ["total", "sum"]):
            total = _total(df, revenue_col)
            if total is not None:
                return {"answer": f"Total revenue is ${total:,.2f}.", "intent": "total_revenue", "metric_column": revenue_col}
        if any(k in lower for k in ["average", "avg", "mean"]):
            avg = _average(df, revenue_col)
            if avg is not None:
                return {"answer": f"Average revenue per record is ${avg:,.2f}.", "intent": "avg_revenue", "metric_column": revenue_col}
        if any(k in lower for k in ["max", "maximum", "peak", "highest"]):
            m = _max_val(df, revenue_col)
            if m is not None:
                return {"answer": f"Highest single revenue record is ${m:,.2f}.", "intent": "max_revenue", "metric_column": revenue_col}
        # Default: total
        total = _total(df, revenue_col)
        if total is not None:
            return {"answer": f"Total revenue is ${total:,.2f}.", "intent": "total_revenue", "metric_column": revenue_col}

    # ── Quantity aggregates ───────────────────────────────────────────────────
    if any(k in lower for k in ["quantity", "units", "qty"]) and quantity_col:
        if any(k in lower for k in ["total", "sum"]):
            total = _total(df, quantity_col)
            if total is not None:
                return {"answer": f"Total quantity sold is {int(total):,} units.", "intent": "total_quantity", "metric_column": quantity_col}
        if any(k in lower for k in ["average", "avg", "mean"]):
            avg = _average(df, quantity_col)
            if avg is not None:
                return {"answer": f"Average quantity per record is {avg:,.2f} units.", "intent": "avg_quantity", "metric_column": quantity_col}
        # Default: average
        avg = _average(df, quantity_col)
        if avg is not None:
            return {"answer": f"Average quantity per record is {avg:,.2f} units.", "intent": "avg_quantity", "metric_column": quantity_col}

    # ── Row count fallback ────────────────────────────────────────────────────
    if any(k in lower for k in ["how many", "count", "total number", "number of rows"]):
        return {"answer": f"The dataset contains {len(df):,} rows.", "intent": "row_count"}

    # ── Profit/margin → redirect to revenue ──────────────────────────────────
    if any(k in lower for k in ["profit", "margin"]) and revenue_col:
        total = _total(df, revenue_col)
        if total is not None:
            return {
                "answer": (
                    f"No dedicated profit column was detected. "
                    f"Total revenue is ${total:,.2f}. "
                    "Consider adding a profit or margin column for deeper analysis."
                ),
                "intent": "profit_fallback",
                "metric_column": revenue_col,
            }

    return None


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/ai-chat/{file_id}")
def ai_chat(
    file_id: str,
    q: Question,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    df = load_dataframe(file_doc["path"])
    result = answer_business_question(df, q.question)

    if result is None:
        return {
            "question": q.question,
            "supported": False,
            "answer": (
                "I could not confidently identify the metric. "
                "Try asking: top salesman, lowest region, total revenue, "
                "best product, average quantity, how many rows."
            ),
            "insights": generate_insights(df),
        }

    return {
        "question": q.question,
        "supported": True,
        "answer": result["answer"],
        "intent": result.get("intent"),
        "metric_column": result.get("metric_column"),
        "dimension_column": result.get("dimension_column"),
    }


@router.post("/ai-ask/{file_id}")
def ai_ask(
    file_id: str,
    q: Question,
    current_user: dict = Depends(get_current_user),
):
    return ai_chat(file_id, q, current_user)
