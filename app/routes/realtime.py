"""Real-Time Analytics endpoints.

Architecture for live data ingestion:
- REST endpoint for pushing transactions
- Polling endpoint for KPI snapshots
- WebSocket for live dashboard streaming
"""
import logging
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe, safe_number
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user, insert_realtime_point, get_realtime_data

router = APIRouter(prefix="/realtime", tags=["realtime"])
logger = logging.getLogger(__name__)

# In-memory WebSocket connection manager
_ws_connections: dict[str, list[WebSocket]] = {}


class DataPoint(BaseModel):
    file_id: str
    metric: str
    value: float
    timestamp: str = ""
    metadata: dict = {}


@router.post("/push")
def push_data_point(
    point: DataPoint,
    current_user: dict = Depends(get_current_user),
):
    """Ingest a single live data point."""
    ts = point.timestamp or datetime.utcnow().isoformat()
    record = {
        "point_id": str(uuid.uuid4()),
        "user_id": current_user["user_id"],
        "file_id": point.file_id,
        "metric": point.metric,
        "value": point.value,
        "timestamp": ts,
        "metadata": point.metadata,
    }
    insert_realtime_point(record)
    return {"point_id": record["point_id"], "timestamp": ts, "status": "ingested"}


@router.get("/kpis/{file_id}")
def get_live_kpis(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get current KPI snapshot from the dataset (polling endpoint)."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    kpis: list[dict] = []
    for col in df.select_dtypes(include="number").columns[:8]:
        vals = df[col].apply(safe_number).dropna()
        if vals.empty or vals.nunique() < 2:
            continue
        kpis.append({
            "metric": col,
            "total": round(float(vals.sum()), 2),
            "average": round(float(vals.mean()), 2),
            "latest": round(float(vals.iloc[-1]), 2),
            "trend": "up" if len(vals) >= 2 and vals.iloc[-1] > vals.iloc[-2] else "down",
            "change_pct": round(
                float((vals.iloc[-1] - vals.iloc[-2]) / abs(vals.iloc[-2]) * 100)
                if len(vals) >= 2 and vals.iloc[-2] != 0 else 0.0, 2
            ),
        })

    # Include any live-pushed points
    live_points = get_realtime_data(current_user["user_id"], file_id, limit=20)

    return {
        "file_id": file_id,
        "snapshot_at": datetime.utcnow().isoformat(),
        "kpis": kpis,
        "live_points": live_points,
        "total_rows": len(df),
        "auto_refresh_interval_seconds": 30,
    }


@router.websocket("/ws/{file_id}")
async def websocket_dashboard(websocket: WebSocket, file_id: str):
    """WebSocket endpoint for real-time dashboard streaming.

    Clients connect and receive KPI push updates when new data arrives.
    Send a JSON message {"ping": true} to get an immediate snapshot.
    """
    await websocket.accept()
    _ws_connections.setdefault(file_id, []).append(websocket)
    logger.info("WebSocket connected for file_id=%s", file_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("ping"):
                await websocket.send_json({
                    "type": "pong",
                    "timestamp": datetime.utcnow().isoformat(),
                    "file_id": file_id,
                    "message": "WebSocket connection active",
                })
    except WebSocketDisconnect:
        conns = _ws_connections.get(file_id, [])
        if websocket in conns:
            conns.remove(websocket)
        logger.info("WebSocket disconnected for file_id=%s", file_id)
    except Exception as exc:
        logger.warning("WebSocket error for file_id=%s: %s", file_id, exc)
        conns = _ws_connections.get(file_id, [])
        if websocket in conns:
            conns.remove(websocket)
