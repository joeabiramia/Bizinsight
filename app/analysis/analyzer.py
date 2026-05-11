from datetime import datetime

import pandas as pd

from app.dataframe_utils import safe_number

KEYWORDS = {
    "revenue": ["revenue", "sales", "total", "amount", "price", "value"],
    "quantity": ["quantity", "qty", "units", "count"],
    "product": ["product", "item", "sku", "title", "category", "name"],
    "region": ["region", "territory", "area", "country", "state"],
    "salesman": ["salesman", "salesperson", "rep", "agent", "owner"],
}


def find_column(df, candidates):
    lower_columns = {str(col).lower(): col for col in df.columns}
    for candidate in candidates:
        for key, original in lower_columns.items():
            if candidate in key:
                return original
    return None


def aggregate_by_column(df, group_col, value_col=None, top_n=6):
    if not group_col or group_col not in df.columns:
        return []

    if value_col and value_col in df.columns:
        temp = df[[group_col, value_col]].copy()
        temp["_value"] = temp[value_col].apply(safe_number).fillna(0)
        grouped = temp.groupby(group_col, dropna=False)["_value"].sum().reset_index()
        grouped = grouped.rename(columns={"_value": "value", group_col: "name"})
    else:
        grouped = df[group_col].fillna("Unknown").value_counts().reset_index()
        grouped.columns = ["name", "value"]

    grouped["name"] = grouped["name"].fillna("Unknown").astype(str)
    grouped = grouped.sort_values(by="value", ascending=False).head(top_n)
    return grouped.to_dict(orient="records")


def build_quantity_distribution(series):
    if series is None or series.empty:
        return []
    values = series.apply(safe_number).dropna()
    if values.empty:
        return []
    max_value = max(values.max(), 100)
    bins = [0, 10, 50, 100, max_value + 1]
    labels = ["0-10", "11-50", "51-100", ">100"]
    distribution = pd.cut(values, bins=bins, labels=labels, include_lowest=True, duplicates="drop")
    result = distribution.value_counts().sort_index().reset_index()
    result.columns = ["range", "count"]
    return result.to_dict(orient="records")


def _best_value_from_group(df, group_col, value_col):
    if not group_col or not value_col or group_col not in df.columns or value_col not in df.columns:
        return None
    data = aggregate_by_column(df, group_col, value_col, top_n=1)
    return data[0] if data else None


def detect_industry(df: pd.DataFrame) -> str:
    col_str = " ".join(str(c).lower() for c in df.columns)
    if any(k in col_str for k in ["patient", "diagnosis", "treatment", "hospital", "medication", "icd"]):
        return "Healthcare"
    if any(k in col_str for k in ["cart", "checkout", "wishlist", "basket", "shipping_cost"]):
        return "E-commerce"
    if any(k in col_str for k in ["employee", "salary", "department", "hire_date", "position", "headcount"]):
        return "Human Resources"
    if any(k in col_str for k in ["ticker", "portfolio", "stock", "fund", "dividend", "nav"]):
        return "Finance / Investments"
    if any(k in col_str for k in ["campaign", "impressions", "ctr", "clicks", "conversion", "ad_spend"]):
        return "Marketing"
    if any(k in col_str for k in ["shipment", "tracking", "warehouse", "delivery", "freight", "logistics"]):
        return "Logistics / Supply Chain"
    if any(k in col_str for k in ["salesman", "salesperson", "rep", "quota", "territory"]):
        return "Sales"
    if any(k in col_str for k in ["product", "sku", "order", "customer", "item"]):
        return "Retail / Sales"
    if any(k in col_str for k in ["revenue", "profit", "expense", "budget", "forecast"]):
        return "Business Finance"
    return "General Business"


def analyze_dataframe(df):
    df = df.copy()
    summary = {
        "columns": [str(col) for col in df.columns],
        "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "data_types": df.dtypes.astype(str).to_dict(),
        "missing_values": df.isnull().sum().astype(int).to_dict(),
        "preview": df.head(10).fillna("").to_dict(orient="records"),
    }

    try:
        summary["statistics"] = df.describe(include="all").fillna("").to_dict()
    except Exception:
        summary["statistics"] = {}

    numeric_df = df.select_dtypes(include=["number"])
    summary["correlations"] = numeric_df.corr().fillna(0).to_dict() if numeric_df.shape[1] > 1 else {}

    revenue_col = find_column(df, KEYWORDS["revenue"])
    quantity_col = find_column(df, KEYWORDS["quantity"])
    product_col = find_column(df, KEYWORDS["product"])
    region_col = find_column(df, KEYWORDS["region"])
    salesman_col = find_column(df, KEYWORDS["salesman"])

    summary["top_summary"] = {
        "total_revenue": float(df[revenue_col].apply(safe_number).fillna(0).sum()) if revenue_col else None,
        "average_quantity": float(df[quantity_col].apply(safe_number).dropna().mean()) if quantity_col else None,
        "best_region": _best_value_from_group(df, region_col, revenue_col),
        "best_salesman": _best_value_from_group(df, salesman_col, revenue_col),
        "best_selling_product": _best_value_from_group(df, product_col, quantity_col or revenue_col),
    }

    summary["chart_data"] = {
        "kpi_means": [
            {"name": str(col), "value": float(df[col].mean())}
            for col in numeric_df.columns
            if pd.notna(df[col].mean())
        ],
        "product_mix": aggregate_by_column(df, product_col, quantity_col or revenue_col) if product_col else [],
        "sales_by_region": aggregate_by_column(df, region_col, revenue_col) if region_col and revenue_col else [],
        "sales_by_salesman": aggregate_by_column(df, salesman_col, revenue_col) if salesman_col and revenue_col else [],
        "quantity_distribution": build_quantity_distribution(df[quantity_col]) if quantity_col else [],
    }

    summary["industry"] = detect_industry(df)
    summary["generated_at"] = datetime.utcnow().isoformat() + "Z"
    return summary
