"""Google Sheets Live Connector.

Supports public Google Sheets via CSV export URL.
Converts any Google Sheets URL into a CSV export URL, fetches it,
and returns a pandas DataFrame reusable by the existing analysis pipeline.
"""
from __future__ import annotations

import io
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Optional

import pandas as pd


# ── URL Parsing ───────────────────────────────────────────────────────────────

_SHEET_ID_PATTERN = re.compile(
    r"docs\.google\.com/spreadsheets/d/([a-zA-Z0-9_-]+)"
)
_GID_PATTERN = re.compile(r"[#&?]gid=(\d+)")


def parse_sheet_url(url: str) -> tuple[str, Optional[str]]:
    """Extract (sheet_id, gid) from any Google Sheets URL variant."""
    m = _SHEET_ID_PATTERN.search(url)
    if not m:
        raise ValueError(
            "Not a valid Google Sheets URL. Expected: "
            "https://docs.google.com/spreadsheets/d/<ID>/..."
        )
    sheet_id = m.group(1)
    gid_m = _GID_PATTERN.search(url)
    gid = gid_m.group(1) if gid_m else None
    return sheet_id, gid


def build_csv_export_url(url: str) -> str:
    """Convert any Google Sheets URL to its CSV export equivalent."""
    sheet_id, gid = parse_sheet_url(url)
    csv_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv"
    if gid:
        csv_url += f"&gid={gid}"
    return csv_url


# ── CSV Fetching ──────────────────────────────────────────────────────────────

def fetch_sheet_as_dataframe(url: str, timeout: int = 30) -> pd.DataFrame:
    """Fetch a public Google Sheet and return a pandas DataFrame.

    Raises:
        ValueError: if the URL is invalid or the sheet is not publicly accessible.
        RuntimeError: if the HTTP request fails.
    """
    csv_url = build_csv_export_url(url)

    headers = {
        "User-Agent": "BizInsight-AI/2.0",
        "Accept": "text/csv,text/plain,*/*",
    }

    try:
        req = urllib.request.Request(csv_url, headers=headers)
        with urllib.request.urlopen(req, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 401 or exc.code == 403:
            raise ValueError(
                "Google Sheet is not publicly accessible. "
                "Set sharing to 'Anyone with the link can view'."
            ) from exc
        raise RuntimeError(f"HTTP {exc.code} fetching Google Sheet: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error fetching Google Sheet: {exc.reason}") from exc

    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise RuntimeError(f"Could not parse CSV from Google Sheet: {exc}") from exc

    if df.empty:
        raise ValueError("Google Sheet returned an empty dataset.")

    return df


# ── Source Metadata Builder ───────────────────────────────────────────────────

def build_source_record(
    source_name: str,
    sheet_url: str,
    refresh_interval: int,
    user_id: str,
    source_id: str,
    file_id: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "source_id": source_id,
        "source_type": "google_sheets",
        "source_name": source_name,
        "sheet_url": sheet_url,
        "csv_export_url": build_csv_export_url(sheet_url),
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
