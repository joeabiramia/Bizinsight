"""
DatasetClassifier — column-name-based industry detection with confidence scoring.

Algorithm
---------
1. Extract all column names from the DataFrame.
2. Tokenise each name: lowercase, split on whitespace / underscores / hyphens /
   camelCase boundaries so "TotalRevenue" → ["total", "revenue"] and
   "mrr_growth" → ["mrr", "growth"].
3. For every industry, sum the weights of every keyword that appears as a token
   OR as a substring of a full normalised column string.  Substring matching lets
   "mrr" fire on a column called "MRR_Q1" without needing an exact token.
4. Normalise raw scores to percentages (0–100).
5. The top industry wins **only** if:
   - its normalised confidence ≥ CONFIDENCE_THRESHOLD (35 %) AND
   - its raw score ≥ MIN_ABSOLUTE_SCORE (avoids false positives on tiny datasets).
6. Otherwise return "general".

Adding a new industry
---------------------
Add one entry to INDUSTRY_SIGNALS (and to INDUSTRY_META).
No UI changes required; the benchmark configuration layer in benchmarks.ts
provides the display data and is keyed to the same slug.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict

import pandas as pd


# ── Keyword weight tables ──────────────────────────────────────────────────────
# Weight convention:
#   8–10  = exclusive / near-exclusive signal for this industry
#   5–7   = strong signal, rare in other domains
#   2–4   = supporting signal, could appear elsewhere
#   1     = weak / coincidental

INDUSTRY_SIGNALS: Dict[str, Dict[str, int]] = {
    "retail": {
        # exclusive
        "sku": 8, "aov": 9, "basket": 7, "checkout": 6, "coupon": 6,
        "merchandise": 7, "storefront": 8, "barcode": 8, "upc": 9,
        # strong
        "inventory": 5, "cart": 5, "refund": 5, "discount": 4, "returns": 4,
        "retail": 8, "units": 4, "sold": 4, "purchase": 4, "promo": 5,
        # supporting
        "product": 3, "category": 3, "order": 3, "customer": 2, "store": 2, "quantity": 3,
    },
    "technology": {  # SaaS / subscription
        # exclusive
        "mrr": 10, "arr": 10, "saas": 10, "nrr": 9, "arpu": 9, "mau": 8, "dau": 8,
        "churn": 9, "cac": 9, "ltv": 9, "clv": 9, "grr": 9,
        # strong
        "subscription": 7, "seats": 7, "license": 6, "trial": 6, "renewal": 6,
        "activation": 6, "upsell": 6, "expansion": 5, "freemium": 8,
        # supporting
        "plan": 4, "users": 3, "accounts": 3, "retention": 4, "onboarding": 3,
    },
    "finance": {
        # exclusive
        "aum": 9, "roe": 9, "roa": 9, "nav": 9, "liabilities": 8, "ledger": 8,
        "bonds": 8, "securities": 8, "derivatives": 9,
        # strong
        "assets": 6, "equity": 6, "loans": 7, "deposits": 7, "interest": 5,
        "portfolio": 6, "fund": 5, "dividend": 7, "capital": 5, "credit": 5,
        "shares": 6, "yield": 5,
        # supporting
        "balance": 4, "debit": 3, "transaction": 3, "account": 2,
    },
    "hr": {
        # exclusive
        "headcount": 9, "attrition": 9, "enps": 10, "payroll": 9, "absenteeism": 9,
        "appraisal": 8, "offboarding": 8, "timeto": 7,  # time-to-hire fragments
        # strong
        "employee": 8, "hire": 7, "salary": 8, "turnover": 7, "tenure": 7,
        "workforce": 8, "recruiter": 7, "leave": 5, "benefits": 5,
        # supporting
        "department": 5, "staff": 4, "training": 4, "performance": 3, "role": 2,
    },
    "logistics": {
        # exclusive
        "freight": 9, "logistics": 10, "shipment": 9, "dispatch": 8, "pallets": 9,
        "customs": 8, "consignment": 9, "incoterms": 10,
        # strong
        "warehouse": 8, "carrier": 7, "fleet": 7, "fulfillment": 7, "dock": 7,
        "tracking": 5, "transit": 7, "route": 5, "driver": 5,
        # supporting
        "delivery": 5, "shipping": 4, "supply": 4, "chain": 3,
    },
    "manufacturing": {
        # exclusive
        "oee": 10, "manufacturing": 10, "defect": 9, "scrap": 9, "downtime": 8,
        "workorder": 9, "bom": 9, "throughput": 8, "yield": 7,
        # strong
        "production": 6, "assembly": 7, "batch": 6, "plant": 6, "machine": 6,
        "capacity": 5, "shift": 6, "cycle": 5,
        # supporting
        "quality": 4, "output": 4, "units": 3,
    },
    "travel": {
        # exclusive
        "itinerary": 9, "accommodation": 9, "checkin": 8, "departure": 8, "arrival": 8,
        "passenger": 8, "occupancy": 8, "reservation": 8,
        # strong
        "booking": 7, "destination": 8, "flight": 8, "hotel": 7, "tour": 6,
        "trip": 6, "travel": 8, "cancellation": 5, "commission": 5,
        # supporting
        "agent": 3, "guests": 4, "nights": 5, "checkout": 3,
    },
}

INDUSTRY_META: Dict[str, dict] = {
    "retail":        {"label": "Retail & E-commerce",     "icon": "🛍"},
    "technology":    {"label": "SaaS / Technology",        "icon": "💻"},
    "finance":       {"label": "Financial Services",       "icon": "🏦"},
    "hr":            {"label": "HR & Workforce",           "icon": "👥"},
    "logistics":     {"label": "Logistics & Supply Chain", "icon": "🚚"},
    "manufacturing": {"label": "Manufacturing",            "icon": "🏭"},
    "travel":        {"label": "Travel & Hospitality",     "icon": "✈️"},
    "general":       {"label": "General Business",         "icon": "📊"},
}

CONFIDENCE_THRESHOLD = 0.35   # top industry must own ≥ 35 % of total score
MIN_ABSOLUTE_SCORE   = 4      # … and score at least 4 raw weight points


# ── Tokeniser ──────────────────────────────────────────────────────────────────

_CAMEL_RE = re.compile(r"(?<=[a-z])(?=[A-Z])")


def _tokenise(col_name: str) -> list[str]:
    """Split a column name into lowercase tokens."""
    s = str(col_name)
    s = _CAMEL_RE.sub(" ", s)          # camelCase → camel Case
    s = re.sub(r"[^a-zA-Z0-9]+", " ", s)   # punctuation / underscores → space
    return [t.lower() for t in s.split() if t]


# ── Classifier ─────────────────────────────────────────────────────────────────

@dataclass
class ClassificationResult:
    industry: str                          # benchmark key ("retail", "general", …)
    label: str                             # human-readable label
    icon: str                              # emoji
    confidence: float                      # 0.0–1.0
    scores: Dict[str, float] = field(default_factory=dict)   # normalised per-industry


def classify_dataset(df: pd.DataFrame) -> ClassificationResult:
    """
    Analyse *df* and return the most likely industry classification.

    Parameters
    ----------
    df : pd.DataFrame
        The uploaded dataset (only column names are used).

    Returns
    -------
    ClassificationResult
    """
    columns = [str(c) for c in df.columns]

    # Build token set and full normalised column strings for substring matching
    token_set: set[str] = set()
    normalised_cols: list[str] = []
    for col in columns:
        tokens = _tokenise(col)
        token_set.update(tokens)
        normalised_cols.append(" ".join(tokens))

    col_blob = " ".join(normalised_cols)   # single string for substring search

    # Score each industry
    raw: Dict[str, float] = {}
    for industry, keywords in INDUSTRY_SIGNALS.items():
        score = 0.0
        for keyword, weight in keywords.items():
            # Token-level match (exact word)
            if keyword in token_set:
                score += weight
            # Substring match on full normalised column blob (catches "mrr_q1" → "mrr")
            elif keyword in col_blob:
                score += weight * 0.8   # slight penalty for non-exact match
        raw[industry] = score

    total = sum(raw.values())

    if total < MIN_ABSOLUTE_SCORE:
        return _general_result(raw)

    # Normalise
    normalised = {ind: raw[ind] / total for ind in raw}
    top_industry = max(normalised, key=normalised.__getitem__)
    top_conf = normalised[top_industry]

    if raw[top_industry] < MIN_ABSOLUTE_SCORE or top_conf < CONFIDENCE_THRESHOLD:
        return _general_result(normalised)

    meta = INDUSTRY_META[top_industry]
    return ClassificationResult(
        industry=top_industry,
        label=meta["label"],
        icon=meta["icon"],
        confidence=round(top_conf, 4),
        scores={ind: round(normalised[ind], 4) for ind in normalised},
    )


def _general_result(raw_or_norm: Dict[str, float]) -> ClassificationResult:
    total = sum(raw_or_norm.values()) or 1.0
    normalised = {ind: raw_or_norm[ind] / total for ind in raw_or_norm}
    meta = INDUSTRY_META["general"]
    return ClassificationResult(
        industry="general",
        label=meta["label"],
        icon=meta["icon"],
        confidence=0.0,
        scores={ind: round(normalised.get(ind, 0.0), 4) for ind in INDUSTRY_META},
    )


def get_industry_meta(industry: str) -> dict:
    return INDUSTRY_META.get(industry, INDUSTRY_META["general"])
