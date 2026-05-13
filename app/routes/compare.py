"""Multi-Dataset Comparison.

POST /compare  → side-by-side KPI and metric comparison of two datasets
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(tags=["compare"])


class CompareRequest(BaseModel):
    file_id_a: str
    file_id_b: str
    label_a: str = ""
    label_b: str = ""


def _extract_kpis(df: pd.DataFrame) -> dict:
    kpis: dict = {"rows": len(df), "columns": len(df.columns), "metrics": {}}
    for col in df.select_dtypes(include="number").columns[:8]:
        vals = df[col].apply(safe_number).dropna()
        if vals.empty or vals.nunique() < 2:
            continue
        kpis["metrics"][col] = {
            "total": round(float(vals.sum()), 2),
            "mean": round(float(vals.mean()), 2),
            "median": round(float(vals.median()), 2),
            "max": round(float(vals.max()), 2),
            "min": round(float(vals.min()), 2),
        }
    return kpis


def _diff_metric(a: float, b: float) -> dict:
    if b == 0:
        pct = None
    else:
        pct = round((a - b) / abs(b) * 100, 2)
    return {
        "a": a,
        "b": b,
        "diff": round(a - b, 2),
        "pct_change": pct,
        "winner": "a" if a > b else "b" if b > a else "tie",
    }


@router.post("/compare")
def compare_datasets(
    body: CompareRequest,
    current_user: dict = Depends(get_current_user),
):
    uid = current_user["user_id"]
    doc_a = get_file_record_for_user(body.file_id_a, uid)
    doc_b = get_file_record_for_user(body.file_id_b, uid)
    if not doc_a:
        raise HTTPException(status_code=404, detail="First dataset not found.")
    if not doc_b:
        raise HTTPException(status_code=404, detail="Second dataset not found.")

    df_a = load_dataframe(doc_a["path"])
    df_b = load_dataframe(doc_b["path"])

    kpis_a = _extract_kpis(df_a)
    kpis_b = _extract_kpis(df_b)

    shared_metrics = set(kpis_a["metrics"].keys()) & set(kpis_b["metrics"].keys())
    comparison: list[dict] = []
    for metric in sorted(shared_metrics):
        m_a = kpis_a["metrics"][metric]
        m_b = kpis_b["metrics"][metric]
        comparison.append({
            "metric": metric,
            "total": _diff_metric(m_a["total"], m_b["total"]),
            "mean": _diff_metric(m_a["mean"], m_b["mean"]),
        })

    only_a = [m for m in kpis_a["metrics"] if m not in shared_metrics]
    only_b = [m for m in kpis_b["metrics"] if m not in shared_metrics]

    return {
        "label_a": body.label_a or doc_a.get("filename", "Dataset A"),
        "label_b": body.label_b or doc_b.get("filename", "Dataset B"),
        "file_id_a": body.file_id_a,
        "file_id_b": body.file_id_b,
        "meta_a": {"rows": kpis_a["rows"], "columns": kpis_a["columns"]},
        "meta_b": {"rows": kpis_b["rows"], "columns": kpis_b["columns"]},
        "comparison": comparison,
        "only_in_a": only_a,
        "only_in_b": only_b,
        "shared_metrics": len(shared_metrics),
    }
