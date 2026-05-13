"""Excel Online / OneDrive Integration via Microsoft Graph API.

Authentication flow:
  1. GET  /excel/auth-url     → returns Microsoft OAuth URL for frontend redirect
  2. POST /excel/callback     → exchanges auth code for tokens, stores in source record
  3. GET  /excel/files        → lists user's Excel files in OneDrive
  4. POST /connect/excel-online → connects a specific file and runs initial sync

Token storage lives inside the data_source record (tokens dict).
In production, encrypt the refresh_token at rest.

Environment variables:
  AZURE_CLIENT_ID      - Azure App Registration client ID
  AZURE_CLIENT_SECRET  - Azure App Registration client secret
  AZURE_REDIRECT_URI   - OAuth redirect URI (e.g. http://localhost:5173/excel/callback)
"""
from __future__ import annotations

import io
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "")
_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
_REDIRECT_URI = os.getenv("AZURE_REDIRECT_URI", "http://localhost:5173/excel/callback")
_AUTHORITY = "https://login.microsoftonline.com/common/oauth2/v2.0"
_GRAPH_BASE = "https://graph.microsoft.com/v1.0"
_SCOPES = "Files.Read.All offline_access User.Read"


# ── OAuth helpers ─────────────────────────────────────────────────────────────

def get_auth_url(state: str = "") -> str:
    """Return the Microsoft OAuth authorization URL."""
    if not _CLIENT_ID:
        raise ValueError(
            "AZURE_CLIENT_ID is not configured. "
            "Create an Azure App Registration and set AZURE_CLIENT_ID, "
            "AZURE_CLIENT_SECRET, and AZURE_REDIRECT_URI environment variables."
        )
    params = {
        "client_id": _CLIENT_ID,
        "response_type": "code",
        "redirect_uri": _REDIRECT_URI,
        "scope": _SCOPES,
        "response_mode": "query",
        "state": state,
    }
    return f"{_AUTHORITY}/authorize?{urllib.parse.urlencode(params)}"


def exchange_code_for_tokens(code: str) -> dict:
    """Exchange OAuth authorization code for access + refresh tokens."""
    if not _CLIENT_ID or not _CLIENT_SECRET:
        raise ValueError("AZURE_CLIENT_ID and AZURE_CLIENT_SECRET must be configured.")

    data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "client_id": _CLIENT_ID,
        "client_secret": _CLIENT_SECRET,
        "redirect_uri": _REDIRECT_URI,
        "code": code,
        "scope": _SCOPES,
    }).encode()

    req = urllib.request.Request(
        f"{_AUTHORITY}/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            tokens = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Token exchange failed ({exc.code}): {body}") from exc

    tokens["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in", 3600)))
    ).isoformat()
    return tokens


def refresh_access_token(refresh_token: str) -> dict:
    """Use refresh token to get a new access token."""
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "client_id": _CLIENT_ID,
        "client_secret": _CLIENT_SECRET,
        "refresh_token": refresh_token,
        "scope": _SCOPES,
    }).encode()

    req = urllib.request.Request(
        f"{_AUTHORITY}/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            tokens = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Token refresh failed ({exc.code}): {body}") from exc

    tokens["expires_at"] = (
        datetime.now(timezone.utc) + timedelta(seconds=int(tokens.get("expires_in", 3600)))
    ).isoformat()
    return tokens


def _ensure_valid_token(tokens: dict) -> dict:
    """Return tokens with a fresh access_token, refreshing if expired."""
    expires_at_str = tokens.get("expires_at", "")
    if expires_at_str:
        try:
            expires_at = datetime.fromisoformat(expires_at_str)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) < expires_at - timedelta(minutes=5):
                return tokens
        except Exception:
            pass
    refresh_token = tokens.get("refresh_token", "")
    if not refresh_token:
        raise ValueError("Access token expired and no refresh token available. Please reconnect.")
    new_tokens = refresh_access_token(refresh_token)
    return {**tokens, **new_tokens}


# ── Graph API helpers ─────────────────────────────────────────────────────────

def _graph_get(path: str, access_token: str) -> dict:
    req = urllib.request.Request(
        f"{_GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Graph API error ({exc.code}): {body}") from exc


def _graph_download(path: str, access_token: str) -> bytes:
    req = urllib.request.Request(
        f"{_GRAPH_BASE}{path}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        raise RuntimeError(f"Graph API download error ({exc.code}): {body}") from exc


def list_excel_files(tokens: dict) -> tuple[list[dict], dict]:
    """Return list of Excel files from OneDrive and refreshed tokens."""
    tokens = _ensure_valid_token(tokens)
    access_token = tokens["access_token"]

    result = _graph_get(
        "/me/drive/search(q='.xlsx')"
        "?$top=30&$select=id,name,webUrl,lastModifiedDateTime,size",
        access_token,
    )
    files = [
        {
            "item_id": item["id"],
            "name": item["name"],
            "web_url": item.get("webUrl", ""),
            "last_modified": item.get("lastModifiedDateTime", ""),
            "size_bytes": item.get("size", 0),
        }
        for item in result.get("value", [])
        if item.get("name", "").endswith((".xlsx", ".xls", ".xlsm"))
    ]
    return files, tokens


def fetch_excel_as_dataframe(item_id: str, tokens: dict, sheet_name: Optional[str] = None) -> tuple[pd.DataFrame, dict]:
    """Download an Excel file from OneDrive and return a DataFrame and refreshed tokens."""
    tokens = _ensure_valid_token(tokens)
    access_token = tokens["access_token"]

    raw = _graph_download(f"/me/drive/items/{item_id}/content", access_token)
    try:
        df = pd.read_excel(io.BytesIO(raw), sheet_name=sheet_name or 0)
    except Exception as exc:
        raise RuntimeError(f"Could not parse Excel file: {exc}") from exc

    if df.empty:
        raise ValueError("Excel file is empty or has no readable data.")

    return df, tokens


# ── Source record builder ─────────────────────────────────────────────────────

def build_excel_source_record(
    source_name: str,
    item_id: str,
    file_name: str,
    tokens: dict,
    refresh_interval: int,
    user_id: str,
    source_id: str,
    file_id: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "source_id": source_id,
        "source_type": "excel_online",
        "source_name": source_name,
        "item_id": item_id,
        "file_name": file_name,
        "tokens": tokens,
        "refresh_interval": refresh_interval,
        "user_id": user_id,
        "file_id": file_id,
        "created_at": now,
        "last_synced_at": None,
        "status": "pending",
        "row_count": 0,
        "column_count": 0,
        "error": None,
    }


def is_configured() -> bool:
    """Return True if Azure credentials are set."""
    return bool(_CLIENT_ID and _CLIENT_SECRET)
