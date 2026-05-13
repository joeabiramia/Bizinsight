"""Shopify connector routes.

Routes:
  POST /connect/shopify          → Connect a Shopify store
  GET  /shopify/store-info       → Fetch store metadata
  POST /sync/shopify/{source_id} → Re-sync store data
  GET  /shopify/status/{source_id} → Source sync status + store summary
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dependencies import get_current_user
from app.integrations.shopify import (
    _normalize_domain,
    build_combined_dataframe,
    build_shopify_source_record,
    fetch_customers,
    fetch_orders,
    fetch_products,
    get_store_info,
)
from app.storage import (
    get_data_source,
    insert_data_source,
    insert_file_record,
    update_data_source,
)

router = APIRouter(tags=["shopify"])
logger = logging.getLogger(__name__)
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")


def _save_df_as_csv(df: pd.DataFrame, source_id: str) -> str:
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    path = os.path.join(UPLOAD_FOLDER, f"shopify_{source_id}.csv")
    df.to_csv(path, index=False)
    return path


def _do_sync(source: dict, user_id: str) -> dict:
    """Fetch latest Shopify data and update file record."""
    shop_domain = source.get("shop_domain", "")
    access_token = source.get("access_token", "")
    if not shop_domain or not access_token:
        raise HTTPException(status_code=422, detail="Missing Shopify credentials. Please reconnect.")

    try:
        orders = fetch_orders(shop_domain, access_token)
        products = fetch_products(shop_domain, access_token)
        df = build_combined_dataframe(orders, products)
    except (ValueError, RuntimeError) as exc:
        update_data_source(source["source_id"], user_id, {"status": "error", "error": str(exc)})
        raise HTTPException(status_code=422, detail=str(exc))

    if df.empty:
        update_data_source(source["source_id"], user_id, {
            "status": "synced",
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
            "row_count": 0,
            "column_count": 0,
            "error": "No orders found in store.",
        })
        raise HTTPException(status_code=422, detail="No orders found in Shopify store.")

    path = _save_df_as_csv(df, source["source_id"])
    now = datetime.now(timezone.utc).isoformat()
    file_id = source.get("file_id") or str(uuid.uuid4())

    insert_file_record({
        "file_id": file_id,
        "filename": f"{source['source_name']}_orders.csv",
        "path": path,
        "user_id": user_id,
        "user_email": "",
        "source_type": "shopify",
        "source_id": source["source_id"],
        "created_at": source.get("created_at", now),
        "updated_at": now,
    })

    updated = {
        "file_id": file_id,
        "status": "synced",
        "last_synced_at": now,
        "row_count": len(df),
        "column_count": len(df.columns),
        "error": None,
        "order_count": len(orders),
        "product_count": len(products),
    }
    update_data_source(source["source_id"], user_id, updated)
    return {**source, **updated, "path": path}


# ── Routes ────────────────────────────────────────────────────────────────────

class ShopifyConnectBody(BaseModel):
    shop_domain: str
    access_token: str
    source_name: str = ""
    refresh_interval: int = 30


@router.post("/connect/shopify")
def connect_shopify(
    body: ShopifyConnectBody,
    current_user: dict = Depends(get_current_user),
):
    """Connect a Shopify store as a live data source."""
    shop_domain = _normalize_domain(body.shop_domain)
    access_token = body.access_token.strip()

    try:
        store_info = get_store_info(shop_domain, access_token)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    source_id = str(uuid.uuid4())
    name = body.source_name.strip() or store_info.get("name", shop_domain)
    source = build_shopify_source_record(
        source_name=name,
        shop_domain=shop_domain,
        access_token=access_token,
        refresh_interval=body.refresh_interval,
        user_id=current_user["user_id"],
        source_id=source_id,
        store_info=store_info,
    )
    insert_data_source(source)

    result = _do_sync(source, current_user["user_id"])
    return {
        "source_id": source_id,
        "file_id": result["file_id"],
        "source_name": name,
        "store": store_info,
        "status": "synced",
        "rows": result["row_count"],
        "columns": result["column_count"],
        "order_count": result.get("order_count", 0),
        "product_count": result.get("product_count", 0),
        "last_synced_at": result["last_synced_at"],
        "refresh_interval_seconds": body.refresh_interval,
        "message": (
            f"'{name}' connected. "
            f"{result.get('order_count', 0)} orders, "
            f"{result.get('product_count', 0)} products synced. "
            f"Dashboard auto-refreshes every {body.refresh_interval}s."
        ),
    }


@router.get("/shopify/store-info")
def get_store_info_route(
    shop_domain: str,
    access_token: str,
    current_user: dict = Depends(get_current_user),
):
    """Preview store info before connecting (validation step)."""
    domain = _normalize_domain(shop_domain)
    try:
        info = get_store_info(domain, access_token)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return info


@router.post("/sync/shopify/{source_id}")
def sync_shopify(
    source_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Re-sync a Shopify source with the latest store data."""
    source = get_data_source(source_id, current_user["user_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    if source.get("source_type") != "shopify":
        raise HTTPException(status_code=400, detail="Not a Shopify source.")
    result = _do_sync(source, current_user["user_id"])
    return {
        "source_id": source_id,
        "file_id": result["file_id"],
        "status": "synced",
        "rows": result["row_count"],
        "order_count": result.get("order_count", 0),
        "last_synced_at": result["last_synced_at"],
        "message": f"Synced {result.get('order_count', 0)} orders → {result['row_count']} rows.",
    }


@router.get("/shopify/status/{source_id}")
def get_shopify_status(
    source_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get Shopify sync status and store summary."""
    source = get_data_source(source_id, current_user["user_id"])
    if not source:
        raise HTTPException(status_code=404, detail="Source not found.")
    return {
        "source_id": source_id,
        "source_name": source.get("source_name"),
        "shop_domain": source.get("shop_domain"),
        "status": source.get("status"),
        "last_synced_at": source.get("last_synced_at"),
        "row_count": source.get("row_count", 0),
        "column_count": source.get("column_count", 0),
        "order_count": source.get("order_count", 0),
        "product_count": source.get("product_count", 0),
        "store_info": source.get("store_info", {}),
        "error": source.get("error"),
        "refresh_interval_seconds": source.get("refresh_interval", 30),
    }
