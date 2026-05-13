"""Live Data Sources — Google Sheets Connector.

Routes:
  POST /connect/google-sheets   → connect a live Google Sheet
  GET  /sources                 → list user's connected sources
  GET  /sync-status/{source_id} → check sync status
  POST /refresh-source/{source_id} → manually trigger a refresh
"""
from __future__ import annotations

import csv
import io
import logging
import os
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.analysis.analyzer import analyze_dataframe
from app.dependencies import get_current_user
from app.integrations.google_sheets import (
    build_source_record,
    fetch_sheet_as_dataframe,
    parse_sheet_url,
)
from app.storage import (
    get_file_record_for_user,
    insert_file_record,
    get_data_source,
    insert_data_source,
    list_data_sources_for_user,
    update_data_source,
)

router = APIRouter(tags=["live-sources"])
logger = logging.getLogger(__name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")


class GoogleSheetConnect(BaseModel):
    sheet_url: str
    source_name: str = ""
    refresh_interval: int = 30


def _save_df_as_csv(df: pd.DataFrame, source_id: str) -> str:
    """Persist dataframe as a CSV file and return the path."""
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    path = os.path.join(UPLOAD_FOLDER, f"gsheet_{source_id}.csv")
    df.to_csv(path, index=False)
    return path


def _sync_source(source: dict, user_id: str) -> dict:
    """Fetch the latest data from the source and update the file record."""
    try:
        df = fetch_sheet_as_dataframe(source["sheet_url"])
    except (ValueError, RuntimeError) as exc:
        update_data_source(source["source_id"], user_id, {
            "status": "error",
            "error": str(exc),
        })
        raise HTTPException(status_code=422, detail=str(exc))

    path = _save_df_as_csv(df, source["source_id"])
    now = datetime.now(timezone.utc).isoformat()

    file_id = source.get("file_id")
    if not file_id:
        file_id = str(uuid.uuid4())

    file_record = {
        "file_id": file_id,
        "filename": f"{source['source_name']}.csv",
        "path": path,
        "user_id": user_id,
        "user_email": "",
        "source_type": "google_sheets",
        "source_id": source["source_id"],
        "created_at": source.get("created_at", now),
        "updated_at": now,
    }
    insert_file_record(file_record)

    updated = {
        "file_id": file_id,
        "status": "synced",
        "last_synced_at": now,
        "row_count": len(df),
        "column_count": len(df.columns),
        "error": None,
    }
    update_data_source(source["source_id"], user_id, updated)
    return {**source, **updated, "path": path, "df": df}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/connect/google-sheets")
def connect_google_sheet(
    body: GoogleSheetConnect,
    current_user: dict = Depends(get_current_user),
):
    """Connect a public Google Sheet as a live data source."""
    try:
        parse_sheet_url(body.sheet_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    source_id = str(uuid.uuid4())
    name = body.source_name.strip() or f"Google Sheet {source_id[:8]}"
    source = build_source_record(
        source_name=name,
        sheet_url=body.sheet_url,
        refresh_interval=body.refresh_interval,
        user_id=current_user["user_id"],
        source_id=source_id,
    )
    insert_data_source(source)

    result = _sync_source(source, current_user["user_id"])

    return {
        "source_id": source_id,
        "file_id": result["file_id"],
        "source_name": name,
        "status": "synced",
        "rows": result["row_count"],
        "columns": result["column_count"],
        "last_synced_at": result["last_synced_at"],
        "refresh_interval_seconds": body.refresh_interval,
        "message": (
            f"Google Sheet connected successfully. "
            f"{result['row_count']} rows, {result['column_count']} columns imported. "
            f"Dashboard will auto-refresh every {body.refresh_interval} seconds."
        ),
    }


@router.get("/sources")
def list_sources(current_user: dict = Depends(get_current_user)):
    """List all live data sources for the current user."""
    sources = list_data_sources_for_user(current_user["user_id"])
    return {"sources": sources, "total": len(sources)}


@router.get("/sync-status/{source_id}")
def get_sync_status(
    source_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get the current sync status of a data source."""
    source = get_data_source(source_id, current_user["user_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found.")
    return {
        "source_id": source_id,
        "source_name": source.get("source_name"),
        "status": source.get("status"),
        "last_synced_at": source.get("last_synced_at"),
        "row_count": source.get("row_count", 0),
        "column_count": source.get("column_count", 0),
        "error": source.get("error"),
        "refresh_interval_seconds": source.get("refresh_interval", 30),
    }


@router.post("/refresh-source/{source_id}")
def refresh_source(
    source_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Manually trigger a data refresh for any live source type."""
    source = get_data_source(source_id, current_user["user_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found.")

    source_type = source.get("source_type", "")

    if source_type == "google_sheets":
        result = _sync_source(source, current_user["user_id"])
        return {
            "source_id": source_id,
            "file_id": result["file_id"],
            "status": "synced",
            "rows": result["row_count"],
            "columns": result["column_count"],
            "last_synced_at": result["last_synced_at"],
            "message": f"Refreshed. {result['row_count']} rows imported.",
        }

    if source_type == "excel_online":
        from app.routes.excel_online import _do_sync as _excel_sync
        result = _excel_sync(source, current_user["user_id"])
        return {
            "source_id": source_id,
            "file_id": result["file_id"],
            "status": "synced",
            "rows": result["row_count"],
            "last_synced_at": result["last_synced_at"],
            "message": f"Excel refreshed. {result['row_count']} rows imported.",
        }

    if source_type == "shopify":
        from app.routes.shopify_connect import _do_sync as _shopify_sync
        result = _shopify_sync(source, current_user["user_id"])
        return {
            "source_id": source_id,
            "file_id": result["file_id"],
            "status": "synced",
            "rows": result["row_count"],
            "last_synced_at": result["last_synced_at"],
            "message": f"Shopify refreshed. {result['row_count']} rows imported.",
        }

    raise HTTPException(
        status_code=400,
        detail=f"Unsupported source type for manual refresh: {source_type}",
    )
