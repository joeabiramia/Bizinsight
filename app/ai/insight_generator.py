import pandas as pd

from app.dataframe_utils import safe_number

_REVENUE_KEYS = ["revenue", "sales", "total", "amount", "price", "value"]
_QUANTITY_KEYS = ["quantity", "qty", "units", "count"]
_PRODUCT_KEYS = ["product", "item", "sku", "title", "category", "name"]
_REGION_KEYS = ["region", "territory", "area", "country", "state"]
_SALESMAN_KEYS = ["salesman", "salesperson", "rep", "agent", "owner"]


def _find_col(df: pd.DataFrame, keywords: list) -> str | None:
    lower = {str(c).lower(): c for c in df.columns}
    for kw in keywords:
        for key, original in lower.items():
            if kw in key:
                return original
    return None


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

    revenue_col = _find_col(df, _REVENUE_KEYS)
    quantity_col = _find_col(df, _QUANTITY_KEYS)
    product_col = _find_col(df, _PRODUCT_KEYS)
    region_col = _find_col(df, _REGION_KEYS)
    salesman_col = _find_col(df, _SALESMAN_KEYS)

    # ── REVENUE ──────────────────────────────────────────────────────────────
    if revenue_col:
        vals = df[revenue_col].apply(safe_number).dropna()
        if not vals.empty:
            total = vals.sum()
            avg = vals.mean()
            top_10_pct = vals.quantile(0.9)
            insights.append({
                "type": "revenue",
                "title": f"Total Revenue: ${total:,.0f}",
                "observation": (
                    f"Total {revenue_col} is ${total:,.2f} with an average of "
                    f"${avg:,.2f} per record. Top 10% of records exceed ${top_10_pct:,.2f}."
                ),
                "interpretation": (
                    "Revenue is concentrated in a small portion of records, "
                    "indicating key accounts or high-value transactions drive the majority of income."
                ),
                "action": (
                    "Focus retention and upsell efforts on the top 10% of revenue records. "
                    "Identify what differentiates them and replicate that profile."
                ),
            })

    # ── PRODUCT ──────────────────────────────────────────────────────────────
    if product_col and revenue_col:
        temp = df[[product_col, revenue_col]].copy()
        temp["_v"] = temp[revenue_col].apply(safe_number).fillna(0)
        grouped = temp.groupby(product_col)["_v"].sum().sort_values(ascending=False)
        if not grouped.empty:
            top = grouped.index[0]
            total_rev = grouped.sum()
            top_pct = (grouped.iloc[0] / total_rev * 100) if total_rev > 0 else 0
            insights.append({
                "type": "opportunity",
                "title": f"Top Product: {top}",
                "observation": f"'{top}' generates {top_pct:.1f}% of total revenue.",
                "interpretation": (
                    "This product is a core revenue driver. Its success may be "
                    "replicable across similar products or markets."
                ),
                "action": (
                    f"Increase marketing budget for '{top}'. Analyse what makes it "
                    "successful and apply those learnings to underperforming products."
                ),
            })
            if len(grouped) > 1:
                bottom = grouped.index[-1]
                bottom_val = grouped.iloc[-1]
                bottom_pct = (bottom_val / total_rev * 100) if total_rev > 0 else 0
                insights.append({
                    "type": "risk",
                    "title": f"Underperforming Product: {bottom}",
                    "observation": f"'{bottom}' contributes only {bottom_pct:.1f}% of total revenue.",
                    "interpretation": (
                        "This product may be consuming resources without delivering "
                        "proportional returns, dragging overall margins."
                    ),
                    "action": (
                        f"Review pricing and promotion strategy for '{bottom}'. "
                        "Consider A/B testing new positioning or phasing it out."
                    ),
                })

    # ── REGION ───────────────────────────────────────────────────────────────
    if region_col and revenue_col:
        temp = df[[region_col, revenue_col]].copy()
        temp["_v"] = temp[revenue_col].apply(safe_number).fillna(0)
        grouped = temp.groupby(region_col)["_v"].sum().sort_values(ascending=False)
        if not grouped.empty:
            top_r = grouped.index[0]
            top_val = grouped.iloc[0]
            insights.append({
                "type": "opportunity",
                "title": f"Strongest Region: {top_r}",
                "observation": f"'{top_r}' leads all regions with ${top_val:,.0f} in revenue.",
                "interpretation": (
                    "This region demonstrates proven market fit and strong demand "
                    "for your product offering."
                ),
                "action": (
                    f"Expand sales headcount and marketing spend in '{top_r}'. "
                    "Study the conditions driving success there and replicate in adjacent regions."
                ),
            })
            if len(grouped) > 1:
                bottom_r = grouped.index[-1]
                bottom_val = grouped.iloc[-1]
                insights.append({
                    "type": "risk",
                    "title": f"Weak Region: {bottom_r}",
                    "observation": f"'{bottom_r}' generates only ${bottom_val:,.0f} — the lowest among all regions.",
                    "interpretation": (
                        "Low regional performance may signal poor market fit, "
                        "insufficient sales coverage, or competitive pressure."
                    ),
                    "action": (
                        f"Conduct a root-cause analysis for '{bottom_r}': survey the market, "
                        "review sales activity logs, and determine whether to invest or exit."
                    ),
                })

    # ── SALESMAN ─────────────────────────────────────────────────────────────
    if salesman_col and revenue_col:
        temp = df[[salesman_col, revenue_col]].copy()
        temp["_v"] = temp[revenue_col].apply(safe_number).fillna(0)
        grouped = temp.groupby(salesman_col)["_v"].sum().sort_values(ascending=False)
        if not grouped.empty:
            top_s = grouped.index[0]
            top_val = grouped.iloc[0]
            total_rev = grouped.sum()
            top_pct = (top_val / total_rev * 100) if total_rev > 0 else 0
            insights.append({
                "type": "performance",
                "title": f"Top Performer: {top_s}",
                "observation": (
                    f"'{top_s}' is responsible for {top_pct:.1f}% of total revenue "
                    f"(${top_val:,.0f})."
                ),
                "interpretation": (
                    "This salesperson significantly outperforms peers and represents "
                    "a critical (and concentrated) revenue dependency."
                ),
                "action": (
                    f"Retain and reward '{top_s}'. Document their techniques and "
                    "run peer coaching sessions to raise the team floor."
                ),
            })
            if len(grouped) > 1:
                bottom_s = grouped.index[-1]
                bottom_val = grouped.iloc[-1]
                bottom_pct = (bottom_val / total_rev * 100) if total_rev > 0 else 0
                insights.append({
                    "type": "risk",
                    "title": f"Needs Development: {bottom_s}",
                    "observation": (
                        f"'{bottom_s}' contributes {bottom_pct:.1f}% of revenue "
                        f"(${bottom_val:,.0f})."
                    ),
                    "interpretation": (
                        "Consistent underperformance may indicate a skills gap, "
                        "poor territory assignment, or motivational issues."
                    ),
                    "action": (
                        f"Pair '{bottom_s}' with a mentor and set a 90-day improvement "
                        "benchmark with clear KPI targets."
                    ),
                })

    # ── PRICING SIGNAL (high qty + low revenue) ───────────────────────────────
    if quantity_col and revenue_col and product_col:
        temp = df[[product_col, quantity_col, revenue_col]].copy()
        temp["_q"] = temp[quantity_col].apply(safe_number).fillna(0)
        temp["_r"] = temp[revenue_col].apply(safe_number).fillna(0)
        ps = temp.groupby(product_col).agg({"_q": "sum", "_r": "sum"}).reset_index()
        ps["_unit"] = ps.apply(
            lambda row: row["_r"] / row["_q"] if row["_q"] > 0 else None, axis=1
        )
        ps = ps.dropna(subset=["_unit"])
        if len(ps) > 1:
            med_q = ps["_q"].median()
            med_u = ps["_unit"].median()
            candidates = ps[(ps["_q"] > med_q) & (ps["_unit"] < med_u)]
            if not candidates.empty:
                flagged = candidates.sort_values("_q", ascending=False).iloc[0][product_col]
                insights.append({
                    "type": "opportunity",
                    "title": f"Potential Underpricing: {flagged}",
                    "observation": (
                        f"'{flagged}' has above-median sales volume but a below-median unit price."
                    ),
                    "interpretation": (
                        "High demand at a low price point suggests there is room to "
                        "increase margins without significantly reducing volume."
                    ),
                    "action": (
                        f"Test a 10–15% price increase for '{flagged}' over 30 days. "
                        "Monitor volume impact before a permanent change."
                    ),
                })

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

    # ── CORRELATION ───────────────────────────────────────────────────────────
    numeric_df = df.select_dtypes(include=["number"])
    if numeric_df.shape[1] > 1:
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
                            "Build a simple regression model to quantify the relationship."
                        ),
                    })

    # ── EXECUTIVE SUMMARY ─────────────────────────────────────────────────────
    parts: list[str] = []
    if revenue_col:
        vals = df[revenue_col].apply(safe_number).dropna()
        if not vals.empty:
            parts.append(f"total revenue of ${vals.sum():,.0f}")
    if product_col:
        parts.append(f"{df[product_col].nunique()} distinct products")
    if region_col:
        parts.append(f"{df[region_col].nunique()} regions")
    if salesman_col:
        parts.append(f"{df[salesman_col].nunique()} sales representatives")

    summary = f"This dataset contains {rows:,} records across {cols} columns"
    if parts:
        summary += f" with {', '.join(parts)}"
    summary += f". {len(insights)} actionable insights were identified."
    if industry:
        summary = f"[{industry.upper()}] " + summary

    return {"insights": insights, "summary": summary}
