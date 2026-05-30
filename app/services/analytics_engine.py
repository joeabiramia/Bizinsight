"""
Dynamic Analytics Engine
========================
Performs real pandas computations against ANY dataset before GPT ever sees it.

GPT's only job is to format the answer and add a recommendation.
All numbers come from actual data — never from GPT.

Workflow
--------
1. classify_intent(question)        → what is the user asking?
2. resolve_columns(df, question)    → which columns answer it?
3. compute_*(df, ...)               → run real pandas aggregation
4. answer_with_rag() in rag_service → send structured result to GPT
"""
from __future__ import annotations

import re
from typing import Optional

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number


# ── Concept vocabularies ───────────────────────────────────────────────────────
# Each entry: concept_name → list of keyword tokens that signal it.
# Column names are tokenised (camelCase / snake_case split) before matching.

ENTITY_VOCAB: dict[str, list[str]] = {
    "customer":   ["customer", "client", "account", "buyer", "consumer", "patron", "purchaser", "shopper"],
    "employee":   ["employee", "staff", "worker", "agent", "salesman", "salesperson", "seller", "rep",
                   "associate", "advisor", "consultant", "person", "member"],
    "product":    ["product", "item", "sku", "goods", "service", "offering", "model", "variant", "listing"],
    "category":   ["category", "type", "class", "group", "segment", "line", "brand", "family", "genre"],
    "region":     ["region", "area", "territory", "location", "zone", "district", "branch", "store",
                   "city", "country", "state", "market", "site", "office", "destination"],
    "department": ["department", "dept", "division", "team", "unit", "function", "group"],
    "channel":    ["channel", "source", "platform", "medium", "campaign", "outlet", "touchpoint"],
    "supplier":   ["supplier", "vendor", "partner", "manufacturer", "provider", "shipper"],
    "project":    ["project", "ticket", "issue", "task", "order", "request", "case", "deal"],
    "date":       ["date", "time", "month", "week", "year", "period", "quarter", "day", "timestamp", "created", "updated"],
}

METRIC_VOCAB: dict[str, list[str]] = {
    "revenue":    ["revenue", "sales", "income", "earning", "turnover", "receipt", "proceeds"],
    "amount":     ["amount", "value", "total", "sum", "payment", "charge", "fee", "price", "cost", "spend", "expenditure"],
    "profit":     ["profit", "margin", "net", "gain", "return", "ebitda", "ebit", "gross"],
    "quantity":   ["quantity", "qty", "units", "volume", "count", "number", "orders", "bookings",
                   "visits", "transactions", "calls", "tickets", "sessions"],
    "rate":       ["rate", "ratio", "percentage", "pct", "percent", "score", "index", "kpi",
                   "nps", "csat", "churn", "conversion", "retention"],
    "salary":     ["salary", "wage", "compensation", "pay", "ctc", "package", "bonus", "remuneration"],
    "duration":   ["hours", "duration", "time", "days", "minutes", "seconds", "age", "tenure", "length"],
    "weight":     ["weight", "mass", "kg", "lbs", "tonnage", "load"],
    "headcount":  ["headcount", "employees", "staff", "people", "workforce", "fte"],
    "arr_mrr":    ["arr", "mrr", "acv", "ltv", "cac", "arpu", "arppu"],
}

# Question-level entity keywords (used to detect what the user is asking about)
QUESTION_ENTITY_HINTS: dict[str, list[str]] = {
    "customer":   ["customer", "client", "account", "buyer", "who buys"],
    "employee":   ["employee", "staff", "agent", "salesperson", "sales rep", "person", "worker", "who sells"],
    "product":    ["product", "item", "sku", "what sells", "best product", "top product"],
    "category":   ["category", "type", "segment", "class"],
    "region":     ["region", "area", "territory", "city", "country", "state", "location", "market", "where"],
    "department": ["department", "team", "division"],
    "channel":    ["channel", "platform", "source"],
    "date":       ["trend", "over time", "monthly", "weekly", "yearly", "quarter", "period", "when", "history"],
}


# ── Tokeniser ──────────────────────────────────────────────────────────────────

def _tokenise(name: str) -> list[str]:
    """Split a column name into lowercase tokens."""
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", str(name))   # camelCase → words
    return [t.lower() for t in re.split(r"[^a-zA-Z0-9]+", s) if len(t) > 1]


def _col_score(col: str, keywords: list[str]) -> float:
    tokens = set(_tokenise(col))
    kw_set = set(keywords)
    matched = tokens & kw_set
    if not matched:
        return 0.0
    # bonus for exact match on the full normalised name
    norm = col.lower().replace(" ", "").replace("_", "").replace("-", "")
    exact_bonus = 0.3 if any(k == norm for k in kw_set) else 0.0
    return len(matched) / max(len(tokens), 1) + exact_bonus


def _rank_cols(df: pd.DataFrame, vocab: dict[str, list[str]], numeric_only: bool = False) -> list[tuple[str, str, float]]:
    """Return list of (col, best_concept, score) sorted best-first."""
    num_set = set(_numeric_cols(df))
    results = []
    for col in df.columns:
        if numeric_only and col not in num_set:
            continue
        best_concept, best_score = "", 0.0
        for concept, kws in vocab.items():
            s = _col_score(col, kws)
            if s > best_score:
                best_concept, best_score = concept, s
        if best_score > 0:
            results.append((col, best_concept, best_score))
    return sorted(results, key=lambda x: x[2], reverse=True)


# ── Column classifiers ─────────────────────────────────────────────────────────

def _numeric_cols(df: pd.DataFrame) -> list[str]:
    result = []
    n = len(df)
    for col in df.columns:
        s = df[col].apply(safe_number).dropna()
        if len(s) >= max(5, n * 0.3) and s.nunique() > 1:
            result.append(col)
    return result


def _categorical_cols(df: pd.DataFrame) -> list[str]:
    num_set = set(_numeric_cols(df))
    n = len(df)
    result = []
    for col in df.columns:
        if col in num_set:
            continue
        nu = df[col].nunique(dropna=True)
        if 1 < nu <= max(60, n * 0.35):
            result.append(col)
    return result


def _date_col(df: pd.DataFrame) -> Optional[str]:
    """Find the best date/time column."""
    ranked = _rank_cols(df, {"date": ENTITY_VOCAB["date"]})
    for col, _, _ in ranked:
        try:
            parsed = pd.to_datetime(df[col], errors="coerce")
            if parsed.notna().sum() >= max(5, len(df) * 0.5):
                return col
        except Exception:
            pass
    # fallback: check dtypes
    for col in df.select_dtypes(include=["datetime", "datetimetz"]).columns:
        return col
    return None


# ── Intent classification ──────────────────────────────────────────────────────

_INTENT_MAP: dict[str, list[str]] = {
    "top_ranking":        ["best", "top", "highest", "most", "leading", "greatest", "largest",
                           "biggest", "peak", "maximum", "number one", "no.1", "champion", "winner"],
    "bottom_ranking":     ["worst", "lowest", "least", "bottom", "minimum", "weakest", "poorest",
                           "smallest", "struggling", "lagging", "underperform", "lowest performing"],
    "total_aggregation":  ["total", "sum", "overall", "aggregate", "combined", "how much", "how many",
                           "entire", "whole", "all together", "grand total"],
    "average_aggregation":["average", "avg", "mean", "typical", "per record", "per unit", "each"],
    "trend_analysis":     ["trend", "over time", "growing", "declining", "improving", "changing",
                           "monthly", "quarterly", "yearly", "weekly", "increase", "decrease",
                           "history", "progression", "evolution"],
    "correlation":        ["correlat", "relate", "relationship", "impact of", "affect", "influence",
                           "drive", "cause", "link", "connection", "associated"],
    "comparison":         ["compare", " vs ", " versus ", "difference between", "against",
                           "relative to", "better than", "worse than"],
    "anomaly":            ["anomal", "outlier", "unusual", "spike", "abnormal", "strange",
                           "unexpected", "irregular", "weird"],
    "distribution":       ["distribut", "breakdown", "split", "proportion", "share", "percentage",
                           "how is it divided", "composition"],
    "forecast":           ["forecast", "predict", "next month", "future", "expect", "project",
                           "upcoming", "will", "projection"],
    "general_summary":    ["summarize", "overview", "summary", "tell me about", "describe",
                           "what is", "how is", "show me", "give me"],
}


def classify_intent(question: str) -> list[str]:
    """Return ordered list of matched intents."""
    lower = question.lower()
    matched: list[str] = []
    for intent, patterns in _INTENT_MAP.items():
        if any(p in lower for p in patterns):
            matched.append(intent)
    return matched or ["general_summary"]


# ── Column resolver ────────────────────────────────────────────────────────────

def resolve_columns(df: pd.DataFrame, question: str) -> dict:
    """
    Dynamically map question → best (entity_col, metric_col, date_col)
    from the actual dataset.  Works on any schema.
    """
    lower = question.lower()
    num_cols = _numeric_cols(df)
    cat_cols = _categorical_cols(df)

    # ── Find entity column ─────────────────────────────────────────────────────
    entity_col: Optional[str] = None
    entity_concept: Optional[str] = None

    # 1. Does the question mention an entity concept?
    for concept, hints in QUESTION_ENTITY_HINTS.items():
        if any(h in lower for h in hints):
            # Find the dataset column that best matches this concept
            vocab = {concept: ENTITY_VOCAB.get(concept, hints)}
            ranked = _rank_cols(df, vocab)
            cat_ranked = [(c, cn, s) for c, cn, s in ranked if c in cat_cols]
            if cat_ranked:
                entity_col = cat_ranked[0][0]
                entity_concept = concept
                break

    # 2. Fallback: best categorical column by entity vocabulary
    if not entity_col and cat_cols:
        ranked = _rank_cols(df, ENTITY_VOCAB)
        cat_ranked = [(c, cn, s) for c, cn, s in ranked if c in cat_cols]
        if cat_ranked:
            entity_col = cat_ranked[0][0]
            entity_concept = cat_ranked[0][1]
        else:
            entity_col = cat_cols[0]

    # ── Find metric column ─────────────────────────────────────────────────────
    metric_col: Optional[str] = None
    metric_concept: Optional[str] = None

    # 1. Does the question mention a metric concept?
    for concept, kws in METRIC_VOCAB.items():
        if any(k in lower for k in kws):
            vocab = {concept: kws}
            ranked = _rank_cols(df, vocab, numeric_only=True)
            num_ranked = [(c, cn, s) for c, cn, s in ranked if c in num_cols]
            if num_ranked:
                metric_col = num_ranked[0][0]
                metric_concept = concept
                break

    # 2. Fallback: best numeric column by metric vocabulary
    if not metric_col and num_cols:
        ranked = _rank_cols(df, METRIC_VOCAB, numeric_only=True)
        num_ranked = [(c, cn, s) for c, cn, s in ranked if c in num_cols]
        if num_ranked:
            metric_col = num_ranked[0][0]
            metric_concept = num_ranked[0][1]
        else:
            metric_col = num_cols[0]  # absolute fallback

    # ── Find date column ───────────────────────────────────────────────────────
    d_col = _date_col(df)

    return {
        "entity_col":      entity_col,
        "entity_concept":  entity_concept,
        "metric_col":      metric_col,
        "metric_concept":  metric_concept,
        "date_col":        d_col,
        "num_cols":        num_cols,
        "cat_cols":        cat_cols,
    }


# ── Analytical computations ────────────────────────────────────────────────────

def compute_top_ranking(
    df: pd.DataFrame,
    entity_col: str,
    metric_col: str,
    n: int = 10,
    ascending: bool = False,
) -> dict:
    vals = df[metric_col].apply(safe_number)
    tmp = df[[entity_col]].copy()
    tmp["_v"] = vals
    grouped = tmp.groupby(entity_col, dropna=False)["_v"].sum().dropna()
    grouped = grouped.sort_values(ascending=ascending)
    total = float(grouped.sum())
    rows = [
        {
            "rank":         i,
            "name":         str(k),
            "value":        round(float(v), 2),
            "pct_of_total": round(float(v) / total * 100, 1) if total else 0,
        }
        for i, (k, v) in enumerate(grouped.head(n).items(), 1)
    ]
    return {
        "type":             "top_ranking",
        "entity_col":       entity_col,
        "metric_col":       metric_col,
        "ascending":        ascending,
        "total":            round(total, 2),
        "unique_entities":  int(grouped.nunique()),
        "rows":             rows,
        "winner":           rows[0] if rows else None,
    }


def compute_aggregation(df: pd.DataFrame, metric_col: str) -> dict:
    vals = df[metric_col].apply(safe_number).dropna()
    return {
        "type":       "aggregation",
        "metric_col": metric_col,
        "count":      int(len(vals)),
        "total":      round(float(vals.sum()), 2),
        "mean":       round(float(vals.mean()), 2),
        "median":     round(float(vals.median()), 2),
        "min":        round(float(vals.min()), 2),
        "max":        round(float(vals.max()), 2),
        "std":        round(float(vals.std()), 2),
        "p25":        round(float(vals.quantile(0.25)), 2),
        "p75":        round(float(vals.quantile(0.75)), 2),
    }


def compute_trend(df: pd.DataFrame, date_col: str, metric_col: str) -> dict:
    try:
        tmp = pd.DataFrame({
            "_date": pd.to_datetime(df[date_col], errors="coerce"),
            "_val":  df[metric_col].apply(safe_number),
        }).dropna()
        if len(tmp) < 3:
            return {"type": "trend", "error": "Not enough records for trend analysis"}
        tmp["_period"] = tmp["_date"].dt.to_period("M")
        monthly = tmp.groupby("_period")["_val"].sum().sort_index()
        periods = [{"period": str(p), "value": round(float(v), 2)} for p, v in monthly.items()]
        vals_list = [p["value"] for p in periods]
        mom = [(vals_list[i] - vals_list[i-1]) / abs(vals_list[i-1]) * 100
               for i in range(1, len(vals_list)) if vals_list[i-1] != 0]
        avg_mom = round(sum(mom) / len(mom), 1) if mom else 0
        direction = "upward" if avg_mom > 1 else "downward" if avg_mom < -1 else "flat"
        return {
            "type":             "trend",
            "date_col":         date_col,
            "metric_col":       metric_col,
            "periods":          periods[-12:],
            "avg_mom_pct":      avg_mom,
            "trend_direction":  direction,
            "best_period":      max(periods, key=lambda x: x["value"]) if periods else None,
            "worst_period":     min(periods, key=lambda x: x["value"]) if periods else None,
            "first_value":      vals_list[0] if vals_list else None,
            "last_value":       vals_list[-1] if vals_list else None,
            "total_change_pct": round((vals_list[-1] - vals_list[0]) / abs(vals_list[0]) * 100, 1)
                                 if len(vals_list) >= 2 and vals_list[0] != 0 else None,
        }
    except Exception as exc:
        return {"type": "trend", "error": str(exc)}


def compute_correlation(df: pd.DataFrame, col_a: str, col_b: str) -> dict:
    a = df[col_a].apply(safe_number).dropna()
    b = df[col_b].apply(safe_number).dropna()
    idx = a.index.intersection(b.index)
    if len(idx) < 5:
        return {"type": "correlation", "error": "Not enough paired records"}
    corr = float(a.loc[idx].corr(b.loc[idx]))
    strength = (
        "very strong" if abs(corr) >= 0.8 else
        "strong"      if abs(corr) >= 0.6 else
        "moderate"    if abs(corr) >= 0.4 else
        "weak"        if abs(corr) >= 0.2 else
        "negligible"
    )
    return {
        "type":        "correlation",
        "col_a":       col_a,
        "col_b":       col_b,
        "coefficient": round(corr, 3),
        "strength":    strength,
        "direction":   "positive" if corr >= 0 else "negative",
        "n_records":   len(idx),
    }


def compute_anomalies(df: pd.DataFrame, metric_col: str, threshold: float = 2.5) -> dict:
    vals = df[metric_col].apply(safe_number).dropna()
    if len(vals) < 10:
        return {"type": "anomaly", "error": "Not enough records"}
    mean, std = float(vals.mean()), float(vals.std())
    z = (vals - mean) / (std + 1e-9)
    outliers = vals[z.abs() > threshold]
    return {
        "type":          "anomaly",
        "metric_col":    metric_col,
        "mean":          round(mean, 2),
        "std":           round(std, 2),
        "threshold_z":   threshold,
        "outlier_count": int(len(outliers)),
        "outlier_pct":   round(len(outliers) / len(vals) * 100, 1),
        "max_outlier":   round(float(outliers.max()), 2) if len(outliers) else None,
        "min_outlier":   round(float(outliers.min()), 2) if len(outliers) else None,
    }


def compute_distribution(
    df: pd.DataFrame,
    entity_col: str,
    metric_col: Optional[str] = None,
) -> dict:
    if metric_col:
        tmp = df[[entity_col]].copy()
        tmp["_v"] = df[metric_col].apply(safe_number)
        grouped = tmp.groupby(entity_col)["_v"].sum().sort_values(ascending=False)
        total = float(grouped.sum())
        rows = [
            {"name": str(k), "value": round(float(v), 2),
             "pct": round(float(v) / total * 100, 1) if total else 0}
            for k, v in grouped.head(15).items()
        ]
    else:
        vc = df[entity_col].value_counts().head(15)
        total = len(df)
        rows = [{"name": str(k), "value": int(v), "pct": round(v / total * 100, 1)}
                for k, v in vc.items()]
    return {
        "type":             "distribution",
        "entity_col":       entity_col,
        "metric_col":       metric_col,
        "rows":             rows,
        "total_categories": int(df[entity_col].nunique(dropna=True)),
    }


def compute_all_column_stats(df: pd.DataFrame) -> dict:
    """Compute aggregation stats for every numeric column — used for general answers."""
    num_cols = _numeric_cols(df)
    result = {}
    for col in num_cols[:12]:
        result[col] = compute_aggregation(df, col)
    return result


def compute_category_counts(df: pd.DataFrame) -> dict:
    """Top-5 value counts for every categorical column."""
    result = {}
    for col in _categorical_cols(df)[:6]:
        vc = df[col].value_counts().head(5)
        result[col] = {str(k): int(v) for k, v in vc.items()}
    return result


# ── Conversational ranking awareness ──────────────────────────────────────────

# Patterns that signal the user is referring back to a previously shown ranking.
_FOLLOWUP_PATTERNS = [
    # positional ordinals
    "who is second", "who is third", "who is fourth", "who is fifth",
    "who is 2nd", "who is 3rd", "who is 4th", "who is 5th",
    "second best", "third best", "fourth best", "fifth best",
    "second place", "third place",
    "runner-up", "runner up",
    "number 2", "number 3", "number 4", "number 5",
    "number two", "number three", "number four", "number five",
    "#2", "#3", "#4", "#5",
    "rank 2", "rank 3", "rank 4", "rank 5",
    "ranked 2", "ranked 3", "ranked 4", "ranked 5",
    # relational / navigational
    "who comes after", "who is after", "who is behind",
    "who is next", "what about next", "and next",
    "next one", "after that", "after them", "after her", "after him",
    "comes after", "right after", "just below",
    # top-N
    "top 3", "top 5", "top 10", "top 4", "top 6", "top 7", "top 8",
    "show top", "list top", "give me top",
    # generic continuation signals combined with ranking words
    "what about the", "what about second", "what about third",
    "who is number",
]


def is_ranking_followup(question: str) -> bool:
    """
    Return True if the question is a follow-up to a previous ranking result.
    Avoids false positives on fresh ranking questions ("who is the best X?").
    """
    lower = question.lower().strip()
    return any(p in lower for p in _FOLLOWUP_PATTERNS)


def extract_rank_request(question: str, ranking: dict) -> Optional[dict]:
    """
    Given a follow-up question and a previous ranking dict (from compute_top_ranking),
    return a focused result dict describing the requested position(s).

    Returns None if the question cannot be mapped to the ranking.
    """
    lower = question.lower()
    rows: list = ranking.get("rows", [])
    if not rows:
        return None

    total = ranking.get("total", 0)
    entity_col = ranking.get("entity_col", "entity")
    metric_col  = ranking.get("metric_col", "metric")

    # ── "after / behind / below NAME" ─────────────────────────────────────────
    after_match = re.search(
        r"(?:after|behind|below|next to|comes after|ranked after|following)\s+([A-Za-z][^\?\.\n]{1,40})",
        lower,
    )
    if after_match:
        name_hint = after_match.group(1).strip().rstrip("?,. ")
        for i, row in enumerate(rows):
            if name_hint in row["name"].lower() or row["name"].lower() in name_hint:
                if i + 1 < len(rows):
                    next_row = rows[i + 1]
                    return {
                        "type":    "after_person",
                        "rows":    [next_row],
                        "context": f"ranked #{next_row['rank']} — just after {row['name']} (#{row['rank']})",
                        "entity_col": entity_col,
                        "metric_col": metric_col,
                        "total":   total,
                    }
                return {
                    "type":    "after_person",
                    "rows":    [],
                    "context": f"{row['name']} is already at the bottom of the shown ranking",
                    "entity_col": entity_col,
                    "metric_col": metric_col,
                    "total":   total,
                }

    # ── "top N" ────────────────────────────────────────────────────────────────
    top_match = re.search(r"top\s*(\d+)", lower)
    if top_match:
        n = min(int(top_match.group(1)), len(rows))
        return {
            "type":       "top_n",
            "rows":       rows[:n],
            "n":          n,
            "context":    f"top {n}",
            "entity_col": entity_col,
            "metric_col": metric_col,
            "total":      total,
        }

    # ── "number N" / "#N" / "rank N" ──────────────────────────────────────────
    num_match = re.search(r"(?:number|#|rank(?:ed)?|position)\s*(\d+)", lower)
    if num_match:
        n = int(num_match.group(1))
        for row in rows:
            if row["rank"] == n:
                return {
                    "type":       "single_rank",
                    "rows":       [row],
                    "context":    f"rank #{n}",
                    "entity_col": entity_col,
                    "metric_col": metric_col,
                    "total":      total,
                }
        return None

    # ── Ordinal words ──────────────────────────────────────────────────────────
    ORDINAL_MAP = {
        "second": 2, "third": 3, "fourth": 4,  "fifth": 5,
        "sixth":  6, "seventh": 7, "eighth": 8, "ninth": 9, "tenth": 10,
        "runner-up": 2, "runner up": 2,
        "2nd": 2, "3rd": 3, "4th": 4, "5th": 5, "6th": 6, "7th": 7,
        "number two": 2, "number three": 3, "number four": 4, "number five": 5,
    }
    for word, n in ORDINAL_MAP.items():
        if word in lower:
            for row in rows:
                if row["rank"] == n:
                    return {
                        "type":       "single_rank",
                        "rows":       [row],
                        "context":    f"rank #{n} ({word})",
                        "entity_col": entity_col,
                        "metric_col": metric_col,
                        "total":      total,
                    }

    # ── "next" / "who is next" → show rank 2 (or rank after the last winner) ──
    next_words = ["who is next", "what about next", "next one", "and next", "after that", "after them"]
    if any(w in lower for w in next_words):
        if len(rows) >= 2:
            return {
                "type":       "single_rank",
                "rows":       [rows[1]],
                "context":    "rank #2 (next after the top performer)",
                "entity_col": entity_col,
                "metric_col": metric_col,
                "total":      total,
            }

    return None
