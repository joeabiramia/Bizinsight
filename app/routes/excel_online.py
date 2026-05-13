"""Excel Online / OneDrive connector routes.

Routes:
  GET  /excel/auth-url           → OAuth authorization URL
  POST /excel/callback           → Exchange auth code for tokens
  GET  /excel/files              → List Excel files in OneDrive
  POST /connect/excel-online     → Connect a specific Excel file
  POST /sync/excel/{source_id}   → Re-sync an Excel file
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.integrations.excel_online import (
    build_excel_source_record,
    exchange_code_for_tokens,
    fetch_excel_as_dataframe,
    get_auth_url,
    is_configured,
    list_excel_files,
)
from app.storage import (
    get_data_source,
    insert_data_source,
    insert_file_record,
    update_data_source,
)

router = APIRouter(tags=["excel-online"])
logger = logging.getLogger(__name__)
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")


def _save_df_as_csv(df: pd.DataFrame, source_id: str) -> str:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    path = os.path.join(UPLOAD_FOLDER, f"excel_{source_id}.csv")
    df.to_csv(path, index=False)
    return path


def _do_sync(source: dict, user_id: str) -> dict:
    """Fetch the Excel file and update the file record. Returns updated metadata."""
    tokens = source.get("tokens") or {}
    item_id = source.get("item_id", "")
    if not item_id or not tokens:
        raise HTTPException(status_code=422, detail="Source is missing credentials. Please reconnect.")

    try:
        df, refreshed_tokens = fetch_excel_as_dataframe(item_id, tokens)
    except (ValueError, RuntimeError) as exc:
        update_data_source(source["source_id"], user_id, {"status": "error", "error": str(exc)})
        raise HTTPException(status_code=422, detail=str(exc))

    path = _save_df_as_csv(df, source["source_id"])
    now = datetime.now(timezone.utc).isoformat()
    file_id = source.get("file_id") or str(uuid.uuid4())

    insert_file_record({
        "file_id": file_id,
        "filename": f"{source['source_name']}.csv",
        "path": path,
        "user_id": user_id,
        "user_email": "",
        "source_type": "excel_online",
        "source_id": source["source_id"],
        "created_at": source.get("created_at", now),
        "updated_at": now,
    })

    updated = {
        "file_id": file_id,
        "tokens": refreshed_tokens,
        "status": "synced",
        "last_synced_at": now,
        "row_count": len(df),
        "column_count": len(df.columns),
        "error": None,
    }
    update_data_source(source["source_id"], user_id, updated)
    return {**source, **updated, "path": path}


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/excel/auth-url")
def get_excel_auth_url(
    current_user: dict = Depends(get_current_user),
    state: str = Query(default=""),
):
    """Return the Microsoft OAuth URL for the frontend to redirect to."""
    if not is_configured():
        return {
            "configured": False,
            "message": (
                "Microsoft OAuth is not configured. "
                "Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_REDIRECT_URI "
                "to enable Excel Online integration."
            ),
            "auth_url": None,
            "setup_guide": (
                "1. Go to portal.azure.com → App registrations → New registration\n"
                "2. Set redirect URI to your AZURE_REDIRECT_URI value\n"
                "3. Add API permission: Microsoft Graph → Files.Read.All\n"
                "4. Create a client secret\n"
                "5. Set AZURE_CLIENT_ID and AZURE_CLIENT_SECRET env vars"
            ),
        }
    try:
        auth_url = get_auth_url(state=state or current_user["user_id"])
        return {"configured": True, "auth_url": auth_url}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


class ExcelCallbackBody(BaseModel):
    code: str
    state: str = ""


@router.post("/excel/callback")
def handle_excel_callback(
    body: ExcelCallbackBody,
    current_user: dict = Depends(get_current_user),
):
    """Exchange OAuth code for tokens. Frontend calls this after Microsoft redirect."""
    try:
        tokens = exchange_code_for_tokens(body.code)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    # Return tokens to frontend for temporary storage (used in the next request)
    return {
        "status": "authorized",
        "access_token": tokens.get("access_token", ""),
        "refresh_token": tokens.get("refresh_token", ""),
        "expires_at": tokens.get("expires_at", ""),
        "token_type": tokens.get("token_type", "Bearer"),
    }


class ExcelFilesRequest(BaseModel):
    access_token: str
    refresh_token: str = ""
    expires_at: str = ""


@router.post("/excel/files")
def list_onedrive_excel_files(
    body: ExcelFilesRequest,
    current_user: dict = Depends(get_current_user),
):
    """List Excel files in the user's OneDrive."""
    tokens = {
        "access_token": body.access_token,
        "refresh_token": body.refresh_token,
        "expires_at": body.expires_at,
    }
    try:
        files, _ = list_excel_files(tokens)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"files": files, "total": len(files)}


class ExcelConnectBody(BaseModel):
    item_id: str
    file_name: str
    source_name: str = ""
    access_token: str
    refresh_token: str = ""
    expires_at: str = ""
    refresh_interval: int = 30


@router.post("/connect/excel-online")
def connect_excel_online(
    body: ExcelConnectBody,
    current_user: dict = Depends(get_current_user),
):
    """Connect a specific OneDrive Excel file as a live data source."""
    tokens = {
        "access_token": body.access_token,
        "refresh_token": body.refresh_token,
        "expires_at": body.expires_at,
    }
    source_id = str(uuid.uuid4())
    name = body.source_name.strip() or body.file_name
    source = build_excel_source_record(
        source_name=name,
        item_id=body.item_id,
        file_name=body.file_name,
        tokens=tokens,
        refresh_interval=body.refresh_interval,
        user_id=current_user["user_id"],
        source_id=source_id,
    )
    insert_data_source(source)

    result = _do_sync(source, current_user["user_id"])
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
            f"'{name}' connected. "
            f"{result['row_count']} rows imported. "
            f"Dashboard auto-refreshes every {body.refresh_interval}s."
        ),
    }


@router.post("/sync/excel/{source_id}")
def sync_excel(
    source_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Re-sync an Excel Online source with the latest OneDrive data."""
    source = get_data_source(source_id, current_user["user_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    if source.get("source_type") != "excel_online":
        raise HTTPException(status_code=400, detail="Not an Excel Online source.")
    result = _do_sync(source, current_user["user_id"])
    return {
        "source_id": source_id,
        "file_id": result["file_id"],
        "status": "synced",
        "rows": result["row_count"],
        "columns": result["column_count"],
        "last_synced_at": result["last_synced_at"],
        "message": f"Synced. {result['row_count']} rows imported.",
    }
