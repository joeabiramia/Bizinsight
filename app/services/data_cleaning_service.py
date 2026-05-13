"""AI Data Cleaning Assistant Service.

Detects and suggests fixes for:
- Missing values
- Duplicates
- Wrong data types
- Date formatting issues
- Currency formatting issues
- Outliers
- Inconsistent category names
"""
from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd

from app.dataframe_utils import safe_number


def _detect_missing(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.columns:
        missing = int(df[col].isnull().sum())
        if missing > 0:
            pct = missing / len(df) * 100
            is_numeric = col in df.select_dtypes(include="number").columns
            issues.append({
                "column": col,
                "issue_type": "missing_values",
                "severity": "high" if pct > 20 else "medium" if pct > 5 else "low",
                "count": missing,
                "percentage": round(pct, 2),
                "description": f"{missing} missing values ({pct:.1f}%) in '{col}'",
                "suggestion": "fill_median" if is_numeric else "fill_mode",
                "fix_label": (
                    f"Fill {missing} missing values with median"
                    if is_numeric else
                    f"Fill {missing} missing values with most common value"
                ),
            })
    return issues


def _detect_duplicates(df: pd.DataFrame) -> list[dict]:
    dup_count = int(df.duplicated().sum())
    if dup_count == 0:
        return []
    pct = dup_count / len(df) * 100
    return [{
        "column": "__all__",
        "issue_type": "duplicates",
        "severity": "high" if pct > 10 else "medium",
        "count": dup_count,
        "percentage": round(pct, 2),
        "description": f"{dup_count} duplicate rows ({pct:.1f}%)",
        "suggestion": "remove_duplicates",
        "fix_label": f"Remove {dup_count} duplicate rows",
    }]


def _detect_type_issues(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include="object").columns:
        sample = df[col].dropna().head(200)
        if sample.empty:
            continue
        try:
            cleaned = sample.astype(str).str.replace(",", "", regex=False).str.replace("$", "", regex=False).str.strip()
            numeric_count = pd.to_numeric(cleaned, errors="coerce").notna().sum()
            if numeric_count / len(sample) > 0.85:
                issues.append({
                    "column": col,
                    "issue_type": "wrong_data_type",
                    "severity": "medium",
                    "count": int(df[col].notna().sum()),
                    "percentage": round(numeric_count / len(sample) * 100, 2),
                    "description": f"'{col}' looks numeric but is stored as text",
                    "suggestion": "convert_to_numeric",
                    "fix_label": f"Convert '{col}' to numeric type",
                })
        except Exception:
            pass
    return issues


def _detect_date_issues(df: pd.DataFrame) -> list[dict]:
    issues = []
    date_keywords = ["date", "time", "created", "updated", "month", "year", "day", "period"]
    for col in df.select_dtypes(include="object").columns:
        if not any(kw in col.lower() for kw in date_keywords):
            continue
        sample = df[col].dropna().head(200)
        if sample.empty:
            continue
        try:
            parsed = pd.to_datetime(sample, errors="coerce")
            valid_pct = parsed.notna().mean()
            if 0.5 < valid_pct < 0.99:
                fail_count = int((1 - valid_pct) * len(sample))
                issues.append({
                    "column": col,
                    "issue_type": "date_format_inconsistency",
                    "severity": "medium",
                    "count": fail_count,
                    "percentage": round((1 - valid_pct) * 100, 2),
                    "description": f"{fail_count} dates in '{col}' could not be parsed (mixed formats)",
                    "suggestion": "standardize_dates",
                    "fix_label": f"Standardize date format in '{col}' to YYYY-MM-DD",
                })
        except Exception:
            pass
    return issues


def _detect_currency_issues(df: pd.DataFrame) -> list[dict]:
    issues = []
    currency_keywords = ["price", "revenue", "sales", "amount", "cost", "fee", "salary", "value", "income"]
    for col in df.select_dtypes(include="object").columns:
        if not any(kw in col.lower() for kw in currency_keywords):
            continue
        sample = df[col].dropna().head(200)
        with_symbols = sample[sample.astype(str).str.contains(r"[\$€£¥,]", na=False, regex=True)]
        if len(with_symbols) > 0:
            pct = len(with_symbols) / len(sample) * 100
            issues.append({
                "column": col,
                "issue_type": "currency_formatting",
                "severity": "low",
                "count": int(len(with_symbols)),
                "percentage": round(pct, 2),
                "description": f"'{col}' contains currency symbols/commas preventing numeric analysis",
                "suggestion": "clean_currency",
                "fix_label": f"Strip currency symbols from '{col}' and convert to float",
            })
    return issues


def _detect_outliers(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include="number").columns:
        vals = df[col].dropna()
        if len(vals) < 10:
            continue
        q1 = vals.quantile(0.25)
        q3 = vals.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            continue
        lower = q1 - 3 * iqr
        upper = q3 + 3 * iqr
        outliers = vals[(vals < lower) | (vals > upper)]
        if len(outliers) > 0:
            pct = len(outliers) / len(vals) * 100
            issues.append({
                "column": col,
                "issue_type": "outliers",
                "severity": "high" if pct > 5 else "medium" if pct > 1 else "low",
                "count": int(len(outliers)),
                "percentage": round(pct, 2),
                "description": (
                    f"{len(outliers)} extreme outliers in '{col}' "
                    f"(outside 3×IQR bounds [{lower:.2f}, {upper:.2f}])"
                ),
                "suggestion": "cap_outliers",
                "fix_label": f"Cap {len(outliers)} outliers in '{col}' to IQR bounds",
                "bounds": {"lower": round(float(lower), 4), "upper": round(float(upper), 4)},
            })
    return issues


def _detect_inconsistent_categories(df: pd.DataFrame) -> list[dict]:
    issues = []
    for col in df.select_dtypes(include="object").columns:
        vals = df[col].dropna()
        if vals.empty or vals.nunique() > 100:
            continue
        lower_map: dict[str, list[str]] = {}
        for v in vals.unique():
            key = str(v).lower().strip()
            lower_map.setdefault(key, []).append(str(v))
        variants = {k: v for k, v in lower_map.items() if len(v) > 1}
        if variants:
            example_count = sum(len(v) - 1 for v in variants.values())
            examples = list(variants.items())[:3]
            example_str = "; ".join(f"'{v[0]}' vs '{v[1]}'" for _, v in examples)
            issues.append({
                "column": col,
                "issue_type": "inconsistent_categories",
                "severity": "medium",
                "count": example_count,
                "percentage": round(example_count / len(vals) * 100, 2),
                "description": f"'{col}' has case/whitespace variants: {example_str}",
                "suggestion": "normalize_categories",
                "fix_label": f"Normalize {example_count} category variants in '{col}' to title case",
            })
    return issues


def analyze_data_quality(df: pd.DataFrame) -> dict:
    """Run all data quality checks and return structured issues."""
    all_issues: list[dict] = []
    all_issues.extend(_detect_missing(df))
    all_issues.extend(_detect_duplicates(df))
    all_issues.extend(_detect_type_issues(df))
    all_issues.extend(_detect_date_issues(df))
    all_issues.extend(_detect_currency_issues(df))
    all_issues.extend(_detect_outliers(df))
    all_issues.extend(_detect_inconsistent_categories(df))

    sev_order = {"high": 0, "medium": 1, "low": 2}
    all_issues.sort(key=lambda x: sev_order.get(x.get("severity", "low"), 3))

    high = sum(1 for i in all_issues if i["severity"] == "high")
    medium = sum(1 for i in all_issues if i["severity"] == "medium")
    low = sum(1 for i in all_issues if i["severity"] == "low")
    quality_score = max(0, 100 - (high * 15) - (medium * 5) - (low * 2))

    return {
        "total_issues": len(all_issues),
        "high_severity": high,
        "medium_severity": medium,
        "low_severity": low,
        "quality_score": quality_score,
        "quality_grade": (
            "A" if quality_score >= 90 else
            "B" if quality_score >= 75 else
            "C" if quality_score >= 60 else "D"
        ),
        "issues": all_issues,
        "rows": len(df),
        "columns": len(df.columns),
        "summary": (
            f"Found {len(all_issues)} data quality issues in {len(df):,} rows × {len(df.columns)} columns: "
            f"{high} critical, {medium} medium, {low} low. Quality score: {quality_score}/100."
        ),
    }


def apply_fix(df: pd.DataFrame, fix: dict) -> tuple[pd.DataFrame, str]:
    """Apply a single data quality fix. Returns (fixed_df, description)."""
    suggestion = fix.get("suggestion", "")
    column = fix.get("column", "")
    df = df.copy()

    if suggestion == "fill_median" and column and column in df.columns:
        median_val = df[column].median()
        filled = int(df[column].isnull().sum())
        df[column] = df[column].fillna(median_val)
        return df, f"Filled {filled} missing values in '{column}' with median ({median_val:.4f})"

    if suggestion == "fill_mode" and column and column in df.columns:
        mode_val = df[column].mode()
        if not mode_val.empty:
            filled = int(df[column].isnull().sum())
            df[column] = df[column].fillna(mode_val.iloc[0])
            return df, f"Filled {filled} missing values in '{column}' with mode ('{mode_val.iloc[0]}')"

    if suggestion == "remove_duplicates":
        before = len(df)
        df = df.drop_duplicates().reset_index(drop=True)
        return df, f"Removed {before - len(df)} duplicate rows"

    if suggestion == "convert_to_numeric" and column and column in df.columns:
        df[column] = pd.to_numeric(
            df[column].astype(str).str.replace(",", "", regex=False).str.replace("$", "", regex=False).str.strip(),
            errors="coerce",
        )
        return df, f"Converted '{column}' to numeric type"

    if suggestion == "standardize_dates" and column and column in df.columns:
        df[column] = pd.to_datetime(df[column], errors="coerce").dt.strftime("%Y-%m-%d")
        return df, f"Standardized date format in '{column}' to YYYY-MM-DD"

    if suggestion == "clean_currency" and column and column in df.columns:
        df[column] = pd.to_numeric(
            df[column].astype(str).str.replace(r"[\$€£¥,]", "", regex=True).str.strip(),
            errors="coerce",
        )
        return df, f"Cleaned currency symbols from '{column}' and converted to float"

    if suggestion == "cap_outliers" and column and column in df.columns:
        q1 = df[column].quantile(0.25)
        q3 = df[column].quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 3 * iqr
        upper = q3 + 3 * iqr
        capped = int(((df[column] < lower) | (df[column] > upper)).sum())
        df[column] = df[column].clip(lower=lower, upper=upper)
        return df, f"Capped {capped} outliers in '{column}' to [{lower:.2f}, {upper:.2f}]"

    if suggestion == "normalize_categories" and column and column in df.columns:
        df[column] = df[column].astype(str).str.strip().str.title()
        return df, f"Normalized category names in '{column}' to title case"

    return df, "No fix applied"
