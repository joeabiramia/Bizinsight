import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import pandas as pd

from app.ai.insight_generator import generate_insights
from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user, insert_chat_message

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
_QUANTITY_SYNS = [
    "quantity", "qty", "units", "volume",
    "visits", "bookings", "trips", "orders", "customers", "count",
]

# Keywords that appear in question text to trigger region intent
_REGION_QUESTION_KEYWORDS = _REGION_SYNS  # same set


def _normalize(name: str) -> str:
    return str(name).lower().replace(" ", "_").replace("-", "_")


def _word_in(word: str, text: str) -> bool:
    """True if `word` appears as a whole word inside `text`."""
    import re
    return bool(re.search(r"\b" + re.escape(word) + r"\b", text))


def find_column_by_synonyms(df: pd.DataFrame, synonyms: list) -> str | None:
    """Iterate synonyms in priority order; return the first matching column.

    Uses word-part matching (split on '_') to avoid false positives like
    'count' matching 'destination_country' or 'rep' matching 'package_revenue'.
    """
    for syn in synonyms:
        for col in df.columns:
            parts = _normalize(col).split("_")
            if syn in parts or _normalize(col) == syn:
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
        if region_col and any(_word_in(k, lower) for k in _REGION_QUESTION_KEYWORDS):
            unique_vals = df[region_col].dropna().unique().tolist()
            return {
                "answer": f"All {region_col} values: {', '.join(str(v) for v in unique_vals)}.",
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
    matched_region_kw = next((k for k in _REGION_QUESTION_KEYWORDS if _word_in(k, lower)), None)
    if matched_region_kw:
        # Prefer the column that contains the exact keyword the user mentioned
        # e.g. "country" → Destination_Country rather than Region
        specific_col = find_column_by_synonyms(df, [matched_region_kw])
        dim_col = specific_col or region_col
    else:
        dim_col = region_col

    if dim_col and matched_region_kw:
        # "list all ..." — no best/worst qualifier
        if any(k in lower for k in ["list", "all", "show"]) and not is_best and not is_worst:
            unique_vals = df[dim_col].dropna().unique().tolist()
            return {
                "answer": f"All {dim_col} values: {', '.join(str(v) for v in unique_vals)}.",
                "intent": "list_unique",
                "dimension_column": dim_col,
            }

        # Detect count/frequency intent: user wants most-visited, not highest revenue
        _count_intent_kws = ["visits", "visited", "popular", "bookings", "trips", "orders", "times", "records", "frequently", "often"]
        wants_count = any(_word_in(k, lower) for k in _count_intent_kws)

        if wants_count and not quantity_col:
            # No dedicated numeric column — count rows per group
            grouped = df.groupby(dim_col, dropna=False).size().sort_values(ascending=False)
            if not grouped.empty:
                if is_worst:
                    label = str(grouped.index[-1])
                    val = int(grouped.iloc[-1])
                    return {
                        "answer": f"The {dim_col} with the fewest visits is '{label}' with {val:,} records.",
                        "intent": "worst_region",
                        "dimension_column": dim_col,
                    }
                else:
                    label = str(grouped.index[0])
                    val = int(grouped.iloc[0])
                    return {
                        "answer": f"The {dim_col} with the most visits is '{label}' with {val:,} records.",
                        "intent": "best_region",
                        "dimension_column": dim_col,
                    }
        else:
            # Sum a metric column
            if wants_count and quantity_col:
                metric_col = quantity_col
            else:
                metric_col = revenue_col or quantity_col
            if not metric_col:
                from app.ai.insight_generator import _classify_columns
                num_cols, _, _ = _classify_columns(df)
                metric_col = num_cols[0] if num_cols else None
            if metric_col:
                is_currency = any(k in metric_col.lower() for k in ["revenue", "sales", "amount", "price", "income"])
                fmt = lambda v: f"${v:,.2f}" if is_currency else f"{v:,.0f}"
                if is_worst:
                    result = _bottom_entry(df, dim_col, metric_col)
                    if result:
                        return {
                            "answer": (
                                f"The lowest {dim_col} by {metric_col} is '{result[0]}' "
                                f"with {fmt(result[1])}."
                            ),
                            "intent": "worst_region",
                            "dimension_column": dim_col,
                            "metric_column": metric_col,
                        }
                else:
                    result = _top_entry(df, dim_col, metric_col)
                    if result:
                        return {
                            "answer": (
                                f"The top {dim_col} by {metric_col} is '{result[0]}' "
                                f"with {fmt(result[1])}."
                            ),
                            "intent": "best_region",
                            "dimension_column": dim_col,
                            "metric_column": metric_col,
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
    _quantity_question_keywords = ["quantity", "units", "qty", "visits", "bookings", "trips", "orders"]
    if any(_word_in(k, lower) for k in _quantity_question_keywords) and quantity_col:
        if any(k in lower for k in ["total", "sum"]):
            total = _total(df, quantity_col)
            if total is not None:
                return {"answer": f"Total {quantity_col} is {int(total):,}.", "intent": "total_quantity", "metric_column": quantity_col}
        if any(k in lower for k in ["average", "avg", "mean"]):
            avg = _average(df, quantity_col)
            if avg is not None:
                return {"answer": f"Average {quantity_col} per record is {avg:,.2f}.", "intent": "avg_quantity", "metric_column": quantity_col}
        # Default: total
        total = _total(df, quantity_col)
        if total is not None:
            return {"answer": f"Total {quantity_col} is {int(total):,}.", "intent": "total_quantity", "metric_column": quantity_col}

    # ── Row count fallback (whole-word match to avoid "country" → "count") ────
    if any(k in lower for k in ["how many", "total number", "number of rows"]) or _word_in("count", lower):
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

def _save_messages(user_id: str, file_id: str, question: str, answer: str, intent: str = "", source: str = "") -> None:
    now = datetime.now(timezone.utc).isoformat()
    base = {"user_id": user_id, "file_id": file_id, "timestamp": now}
    insert_chat_message({**base, "message_id": str(uuid.uuid4()), "role": "user", "content": question})
    insert_chat_message({**base, "message_id": str(uuid.uuid4()), "role": "assistant", "content": answer, "intent": intent, "source": source})


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
        try:
            from app.services.rag_service import answer_with_rag
            from app.analysis.analyzer import analyze_dataframe
            analysis = analyze_dataframe(df)
            rag_result = answer_with_rag(df, q.question, analysis)
            response = {
                "question": q.question,
                "supported": True,
                "answer": rag_result["answer"],
                "intent": "rag_ai",
                "source": rag_result.get("source", "rag"),
                "grounded": rag_result.get("grounded", True),
                "model": rag_result.get("model"),
            }
            _save_messages(current_user["user_id"], file_id, q.question, rag_result["answer"], "rag_ai", rag_result.get("source", "rag"))
            return response
        except Exception:
            fallback_answer = (
                "I could not confidently identify the metric. "
                "Try asking: top salesman, lowest region, total revenue, "
                "best product, average quantity, how many rows."
            )
            _save_messages(current_user["user_id"], file_id, q.question, fallback_answer, "fallback", "error")
            return {
                "question": q.question,
                "supported": False,
                "answer": fallback_answer,
                "insights": generate_insights(df),
            }

    _save_messages(current_user["user_id"], file_id, q.question, result["answer"], result.get("intent", ""), "structured_query")
    return {
        "question": q.question,
        "supported": True,
        "answer": result["answer"],
        "intent": result.get("intent"),
        "metric_column": result.get("metric_column"),
        "dimension_column": result.get("dimension_column"),
        "source": "structured_query",
        "grounded": True,
    }


@router.post("/ai-ask/{file_id}")
def ai_ask(
    file_id: str,
    q: Question,
    current_user: dict = Depends(get_current_user),
):
    return ai_chat(file_id, q, current_user)


# ── Dynamic suggestions ───────────────────────────────────────────────────────

def _generate_suggestions(df: pd.DataFrame) -> list[str]:
    """Return 6-8 questions tailored to the actual columns present."""
    suggestions: list[str] = []

    revenue_col = find_column_by_synonyms(df, _REVENUE_SYNS)
    quantity_col = find_column_by_synonyms(df, _QUANTITY_SYNS)
    product_col = find_column_by_synonyms(df, _PRODUCT_SYNS)
    region_col = find_column_by_synonyms(df, _REGION_SYNS)
    salesman_col = find_column_by_synonyms(df, _SALESMAN_SYNS)

    if revenue_col:
        suggestions.append(f"What is the total {revenue_col}?")
    if salesman_col and revenue_col:
        suggestions.append(f"Who is the best {salesman_col} by {revenue_col}?")
        suggestions.append(f"Who is the lowest performing {salesman_col}?")
    if region_col and revenue_col:
        suggestions.append(f"Which {region_col} has the highest {revenue_col}?")
        suggestions.append(f"What is the lowest performing {region_col}?")
    if product_col and revenue_col:
        suggestions.append(f"Which {product_col} is selling the most?")
    if quantity_col:
        suggestions.append(f"What is the average {quantity_col}?")
    if revenue_col:
        suggestions.append(f"What is the average {revenue_col} per record?")

    # Always include meta questions
    suggestions.append("How many rows are in this dataset?")
    suggestions.append("What columns does this dataset have?")

    # If almost no domain columns found, generate generic numeric suggestions
    if len(suggestions) <= 3:
        from app.ai.insight_generator import _classify_columns
        numeric_cols, categorical_cols, _ = _classify_columns(df)
        for num in numeric_cols[:2]:
            suggestions.insert(0, f"What is the total {num}?")
        for cat in categorical_cols[:1]:
            if numeric_cols:
                suggestions.insert(0, f"Which {cat} has the highest {numeric_cols[0]}?")

    return suggestions[:8]


@router.get("/ai-chat/suggestions/{file_id}")
def ai_chat_suggestions(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    df = load_dataframe(file_doc["path"])
    return {"suggestions": _generate_suggestions(df)}
