import os
import re
from fastapi import HTTPException
import pandas as pd


def safe_number(value):
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = re.sub(r"[^0-9.+-]+", "", value)
        if cleaned in ("", ".", "-", "+", "-.", "+."):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def load_dataframe(filepath: str) -> pd.DataFrame:
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Dataset file not found. It may have been removed.")
    lower = filepath.lower()
    if lower.endswith(".csv"):
        return pd.read_csv(filepath)
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(filepath)
    raise HTTPException(status_code=415, detail="Unsupported file type. Please upload CSV, XLSX, or XLS.")


def allowed_filename(filename: str) -> bool:
    return filename.lower().endswith((".csv", ".xlsx", ".xls"))


def safe_upload_name(filename: str) -> str:
    base = os.path.basename(filename or "dataset")
    return re.sub(r"[^A-Za-z0-9._-]+", "_", base)
