import pandas as pd

from app.dataframe_utils import safe_number


_ID_SUFFIXES = ("_id", "id", "_key", "_code", "_num", "_no", "_number", "index")


def _is_id_column(col: str, series: pd.Series) -> bool:
    """Return True if this column looks like a surrogate key / row index."""
    lower = col.lower().replace(" ", "_")
    # Name-based check: column is named like an ID
    if any(lower == s or lower.endswith(s) for s in _ID_SUFFIXES):
        return True
    # Nameless fallback: a plain "id" or "index" column with sequential integers
    if lower in ("id", "index", "row") and pd.api.types.is_integer_dtype(series):
        return True
    return False


def _classify_columns(df: pd.DataFrame):
    """Return (numeric, categorical, datetime) lists based on actual data types."""
    raw_numeric = list(df.select_dtypes(include="number").columns)
    # Filter out ID-like columns from meaningful numerics
    numeric = [c for c in raw_numeric if not _is_id_column(c, df[c])]

    datetime_cols = list(df.select_dtypes(include=["datetime", "datetimetz"]).columns)
    categorical = []

    for col in df.columns:
        if col in raw_numeric or col in datetime_cols:
            continue
        if df[col].dtype == object:
            sample = df[col].dropna().head(200)
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() > 0.7:
                    datetime_cols.append(col)
                    continue
            except Exception:
                pass
        n_unique = df[col].nunique(dropna=True)
        if 1 < n_unique <= max(30, int(len(df) * 0.05)):
            categorical.append(col)

    return numeric, categorical, datetime_cols


def _fmt(value: float, col_name: str = "") -> str:
    """Format a number with comma separators; add decimals only when small."""
    col_lower = col_name.lower()
    is_currency = any(k in col_lower for k in ["price", "revenue", "sales", "amount", "cost", "fee", "salary", "value", "income", "spend"])
    prefix = "$" if is_currency else ""
    if abs(value) >= 1000:
        return f"{prefix}{value:,.0f}"
    return f"{prefix}{value:,.2f}"


def _group_insights(df: pd.DataFrame, cat_col: str, num_col: str, insights: list, max_pairs: int):
    """Generate top/bottom performer insights for a categorical × numeric pair."""
    if len(insights) >= max_pairs:
        return
    temp = df[[cat_col, num_col]].copy()
    temp["_v"] = temp[num_col].apply(safe_number).fillna(0)
    grouped = temp.groupby(cat_col, dropna=False)["_v"].sum().sort_values(ascending=False)
    if grouped.empty:
        return

    total = grouped.sum()
    top_name = str(grouped.index[0])
    top_val = grouped.iloc[0]
    top_pct = (top_val / total * 100) if total > 0 else 0

    insights.append({
        "type": "opportunity",
        "title": f"Top {cat_col}: {top_name}",
        "observation": (
            f"'{top_name}' leads in {num_col} with {_fmt(top_val, num_col)}, "
            f"accounting for {top_pct:.1f}% of the total."
        ),
        "interpretation": (
            f"This is the highest-performing segment in '{cat_col}' by {num_col}. "
            "It represents a proven driver that may be replicable elsewhere."
        ),
        "action": (
            f"Prioritise resources and investment toward '{top_name}'. "
            f"Analyse what makes it outperform and replicate that model across other {cat_col} segments."
        ),
    })

    if len(grouped) > 1:
        bottom_name = str(grouped.index[-1])
        bottom_val = grouped.iloc[-1]
        bottom_pct = (bottom_val / total * 100) if total > 0 else 0
        insights.append({
            "type": "risk",
            "title": f"Lowest {cat_col}: {bottom_name}",
            "observation": (
                f"'{bottom_name}' contributes {_fmt(bottom_val, num_col)} ({bottom_pct:.1f}%) "
                f"— the lowest among all {cat_col} segments."
            ),
            "interpretation": (
                f"This segment underperforms in {num_col} and may be consuming "
                "disproportionate resources relative to its contribution."
            ),
            "action": (
                f"Investigate the root cause for '{bottom_name}': review market conditions, "
                "operational bottlenecks, and whether to invest, reposition, or exit."
            ),
        })


# Legacy string-list format — kept for ai_chat route compatibility
def generate_insights(df: pd.DataFrame) -> list[str]:
    result = generate_business_insights(df)
    lines = []
    for ins in result["insights"]:
        lines.append(f"{ins['title']}: {ins['observation']} → {ins['action']}")
    return lines


def generate_business_insights(
    df: pd.DataFrame, analysis: dict | None = None, industry: str | None = None
) -> dict:
    insights: list[dict] = []
    rows, cols = df.shape

    numeric_cols, categorical_cols, datetime_cols = _classify_columns(df)

    # ── NUMERIC COLUMN SUMMARIES ───────────────────────────────────────────────
    for num_col in numeric_cols[:5]:
        vals = df[num_col].apply(safe_number).dropna()
        if vals.empty or vals.nunique() < 2:
            continue
        total = vals.sum()
        avg = vals.mean()
        p90 = vals.quantile(0.9)
        std = vals.std()

        insights.append({
            "type": "performance",
            "title": f"{num_col} Overview",
            "observation": (
                f"Total {num_col}: {_fmt(total, num_col)}. "
                f"Average: {_fmt(avg, num_col)} per record. "
                f"Top 10% of records exceed {_fmt(p90, num_col)}."
            ),
            "interpretation": (
                f"The spread between average ({_fmt(avg, num_col)}) and top-decile "
                f"({_fmt(p90, num_col)}) indicates meaningful variation across records."
            ),
            "action": (
                f"Focus on the factors that drive the top 10% of {num_col} records. "
                "Identify what distinguishes them and use that as a benchmark."
            ),
        })

        # Outlier alert
        outlier_threshold = avg + 2 * std
        outliers = vals[vals > outlier_threshold]
        if len(outliers) > 0 and len(outliers) < rows * 0.05:
            insights.append({
                "type": "risk",
                "title": f"Outliers Detected in {num_col}",
                "observation": (
                    f"{len(outliers)} record(s) exceed {_fmt(outlier_threshold, num_col)} "
                    f"(mean + 2σ) in {num_col}."
                ),
                "interpretation": (
                    "Outliers can skew averages and distort trend analysis. "
                    "They may represent errors, exceptional cases, or fraud."
                ),
                "action": (
                    f"Review the {len(outliers)} outlier records in {num_col} manually. "
                    "Confirm they are valid before including them in aggregate KPIs."
                ),
            })

    # ── CATEGORICAL × NUMERIC BREAKDOWN INSIGHTS ──────────────────────────────
    # Rank numeric cols by total value (descending)
    sorted_numeric = sorted(
        numeric_cols,
        key=lambda c: df[c].apply(safe_number).fillna(0).sum(),
        reverse=True,
    )
    # Pair each categorical column with the single best numeric — avoids duplicates
    main_numeric = sorted_numeric[0] if sorted_numeric else None
    pair_budget = 8
    if main_numeric:
        for cat_col in categorical_cols[:4]:
            _group_insights(df, cat_col, main_numeric, insights, max_pairs=len(insights) + pair_budget)

    # ── PRICING / UNIT-VALUE SIGNAL ───────────────────────────────────────────
    # Detect high-volume + low-unit-value products/categories
    if len(numeric_cols) >= 2 and categorical_cols:
        cat_col = categorical_cols[0]
        vol_col = sorted_numeric[-1] if len(sorted_numeric) > 1 else None
        val_col = sorted_numeric[0]
        if vol_col and vol_col != val_col:
            temp = df[[cat_col, vol_col, val_col]].copy()
            temp["_vol"] = temp[vol_col].apply(safe_number).fillna(0)
            temp["_val"] = temp[val_col].apply(safe_number).fillna(0)
            ps = temp.groupby(cat_col).agg({"_vol": "sum", "_val": "sum"}).reset_index()
            ps["_unit"] = ps.apply(
                lambda r: r["_val"] / r["_vol"] if r["_vol"] > 0 else None, axis=1
            )
            ps = ps.dropna(subset=["_unit"])
            if len(ps) > 1:
                med_vol = ps["_vol"].median()
                med_unit = ps["_unit"].median()
                candidates = ps[(ps["_vol"] > med_vol) & (ps["_unit"] < med_unit)]
                if not candidates.empty:
                    flagged = str(candidates.sort_values("_vol", ascending=False).iloc[0][cat_col])
                    insights.append({
                        "type": "opportunity",
                        "title": f"Potential Undervaluation: {flagged}",
                        "observation": (
                            f"'{flagged}' has above-median volume in {vol_col} "
                            f"but a below-median unit value in {val_col}."
                        ),
                        "interpretation": (
                            "High demand at a low unit value suggests there may be "
                            "room to improve margins without a significant volume drop."
                        ),
                        "action": (
                            f"Test a pricing or value adjustment for '{flagged}' over 30 days "
                            "and monitor volume impact before committing permanently."
                        ),
                    })

    # ── TIME TREND ────────────────────────────────────────────────────────────
    if datetime_cols and numeric_cols:
        dt_col = datetime_cols[0]
        val_col = sorted_numeric[0]
        try:
            temp = df[[dt_col, val_col]].copy()
            temp[dt_col] = pd.to_datetime(temp[dt_col], errors="coerce")
            temp = temp.dropna(subset=[dt_col])
            temp["_v"] = temp[val_col].apply(safe_number).fillna(0)
            temp["_month"] = temp[dt_col].dt.to_period("M")
            monthly = temp.groupby("_month")["_v"].sum()
            if len(monthly) >= 3:
                recent = monthly.iloc[-1]
                prior = monthly.iloc[-2]
                direction = "up" if recent >= prior else "down"
                pct_change = abs((recent - prior) / prior * 100) if prior != 0 else 0
                insights.append({
                    "type": "performance",
                    "title": f"Recent Trend in {val_col}",
                    "observation": (
                        f"{val_col} is trending {direction} — the most recent period "
                        f"({_fmt(recent, val_col)}) is {pct_change:.1f}% "
                        f"{'higher' if direction == 'up' else 'lower'} than the prior period "
                        f"({_fmt(prior, val_col)})."
                    ),
                    "interpretation": (
                        f"A {'positive' if direction == 'up' else 'declining'} momentum "
                        f"in {val_col} over time {'suggests growth is continuing' if direction == 'up' else 'warrants attention'}."
                    ),
                    "action": (
                        "Review the factors driving this trend and determine whether it "
                        "reflects seasonal patterns, operational changes, or a structural shift."
                    ),
                })
        except Exception:
            pass

    # ── DATA QUALITY ──────────────────────────────────────────────────────────
    missing = df.isnull().sum()
    high_missing = missing[missing > rows * 0.2]
    if not high_missing.empty:
        cols_list = ", ".join(f"'{c}'" for c in high_missing.index[:3].tolist())
        insights.append({
            "type": "risk",
            "title": "Data Quality Warning",
            "observation": f"Columns with >20% missing values: {cols_list}.",
            "interpretation": (
                "Incomplete data reduces analysis reliability and may skew KPIs, "
                "forecasts, and strategic decisions."
            ),
            "action": (
                "Establish data-entry validation at source systems. "
                "Impute or flag missing values before running production analysis."
            ),
        })

    # ── CORRELATIONS ──────────────────────────────────────────────────────────
    if len(numeric_cols) > 1:
        numeric_df = df[numeric_cols]
        try:
            corr = numeric_df.corr()
            reported: set = set()
            for c1 in corr.columns:
                for c2 in corr.columns:
                    pair = tuple(sorted([c1, c2]))
                    if c1 != c2 and pair not in reported and abs(corr[c1][c2]) > 0.6:
                        direction = "positively" if corr[c1][c2] > 0 else "negatively"
                        reported.add(pair)
                        insights.append({
                            "type": "performance",
                            "title": f"Strong Correlation: {c1} & {c2}",
                            "observation": (
                                f"'{c1}' and '{c2}' are strongly {direction} correlated "
                                f"(r = {corr[c1][c2]:.2f})."
                            ),
                            "interpretation": (
                                "This relationship can be leveraged for predictive modelling "
                                "and proactive resource planning."
                            ),
                            "action": (
                                f"Use '{c1}' as a leading indicator when planning '{c2}'. "
                                "Consider building a regression model to quantify and act on this relationship."
                            ),
                        })
        except Exception:
            pass

    # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────────
    parts: list[str] = []
    for num_col in sorted_numeric[:3]:
        vals = df[num_col].apply(safe_number).dropna()
        if not vals.empty:
            parts.append(f"total {num_col} of {_fmt(vals.sum(), num_col)}")
    for cat_col in categorical_cols[:2]:
        parts.append(f"{df[cat_col].nunique()} distinct {cat_col} values")
    if datetime_cols:
        parts.append(f"data spanning {datetime_cols[0]}")

    summary_text = f"This dataset contains {rows:,} records across {cols} columns"
    if parts:
        summary_text += f", covering {', '.join(parts)}"
    summary_text += f". {len(insights)} actionable insights were identified."
    if industry:
        summary_text = f"[{industry.upper()}] " + summary_text

    return {"insights": insights, "summary": summary_text}
