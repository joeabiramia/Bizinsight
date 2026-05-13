"""Shopify Admin API Integration.

Authentication: Private App / Custom App access token.
Users create a Custom App in their Shopify Admin and provide:
  - shop_domain  (e.g. mystore.myshopify.com)
  - access_token (Admin API access token from Custom App)

Synced entities → combined orders DataFrame:
  order_date | product | quantity | revenue | region | customer_id | salesperson

This maps directly to the existing analysis pipeline column detection.
"""
from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Optional

import pandas as pd

logger = logging.getLogger(__name__)

_API_VERSION = "2024-01"


def _normalize_domain(domain: str) -> str:
    """Ensure domain is in format: mystore.myshopify.com"""
    domain = domain.strip().lower()
    domain = domain.replace("https://", "").replace("http://", "").rstrip("/")
    if "/" in domain:
        domain = domain.split("/")[0]
    if not domain.endswith(".myshopify.com"):
        domain = domain + ".myshopify.com"
    return domain


def _shopify_get(shop_domain: str, access_token: str, path: str) -> dict:
    url = f"https://{shop_domain}/admin/api/{_API_VERSION}/{path}"
    req = urllib.request.Request(
        url,
        headers={
            "X-Shopify-Access-Token": access_token,
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        body = exc.read().decode(errors="replace")
        if exc.code == 401:
            raise ValueError(
                "Invalid Shopify access token. Please check your Custom App credentials."
            ) from exc
        if exc.code == 404:
            raise ValueError(
                f"Shopify store '{shop_domain}' not found. Check the store domain."
            ) from exc
        raise RuntimeError(f"Shopify API error ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Network error reaching Shopify: {exc.reason}") from exc


def _paginate_shopify(
    shop_domain: str,
    access_token: str,
    endpoint: str,
    key: str,
    limit: int = 250,
    max_pages: int = 10,
) -> list[dict]:
    """Fetch all pages of a Shopify endpoint using cursor-based pagination."""
    all_items: list[dict] = []
    path = f"{endpoint}?limit={limit}"

    for _ in range(max_pages):
        data = _shopify_get(shop_domain, access_token, path)
        items = data.get(key, [])
        all_items.extend(items)
        if len(items) < limit:
            break
        last_id = items[-1]["id"]
        path = f"{endpoint}?limit={limit}&since_id={last_id}"

    return all_items


# ── Data fetching ─────────────────────────────────────────────────────────────

def get_store_info(shop_domain: str, access_token: str) -> dict:
    """Fetch basic shop information."""
    data = _shopify_get(shop_domain, access_token, "shop.json")
    shop = data.get("shop", {})
    return {
        "name": shop.get("name", shop_domain),
        "domain": shop.get("domain", shop_domain),
        "email": shop.get("email", ""),
        "currency": shop.get("currency", "USD"),
        "country": shop.get("country_name", ""),
        "plan": shop.get("plan_display_name", ""),
    }


def fetch_orders(shop_domain: str, access_token: str) -> list[dict]:
    """Fetch all orders (any status)."""
    return _paginate_shopify(
        shop_domain,
        access_token,
        "orders.json?status=any",
        "orders",
    )


def fetch_products(shop_domain: str, access_token: str) -> list[dict]:
    """Fetch all products with their variants."""
    return _paginate_shopify(shop_domain, access_token, "products.json", "products")


def fetch_customers(shop_domain: str, access_token: str) -> list[dict]:
    """Fetch all customers."""
    return _paginate_shopify(shop_domain, access_token, "customers.json", "customers")


# ── DataFrame builders ────────────────────────────────────────────────────────

def orders_to_dataframe(orders: list[dict]) -> pd.DataFrame:
    """Convert Shopify orders to a flat DataFrame for the analysis pipeline."""
    rows: list[dict] = []
    for order in orders:
        order_id = order.get("id", "")
        created_at = order.get("created_at", "")
        currency = order.get("currency", "USD")
        region = ""
        billing = order.get("billing_address") or {}
        shipping = order.get("shipping_address") or {}
        region = billing.get("city") or shipping.get("city") or billing.get("country") or shipping.get("country") or "Unknown"
        customer = order.get("customer") or {}
        customer_id = customer.get("id") or order.get("email", "guest")

        line_items = order.get("line_items", [])
        for item in line_items:
            qty = float(item.get("quantity", 1))
            price = float(item.get("price", 0))
            rows.append({
                "order_id": str(order_id),
                "date": created_at[:10] if created_at else "",
                "product": item.get("title", "Unknown"),
                "quantity": qty,
                "revenue": round(qty * price, 2),
                "region": str(region),
                "customer_id": str(customer_id),
                "currency": currency,
                "order_status": order.get("financial_status", "unknown"),
            })

    if not rows:
        return pd.DataFrame(columns=["order_id", "date", "product", "quantity", "revenue", "region", "customer_id"])

    df = pd.DataFrame(rows)
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    return df


def products_to_dataframe(products: list[dict]) -> pd.DataFrame:
    """Convert Shopify products + variants to a flat DataFrame."""
    rows: list[dict] = []
    for product in products:
        product_type = product.get("product_type", "")
        vendor = product.get("vendor", "")
        for variant in product.get("variants", []):
            rows.append({
                "product": product.get("title", "Unknown"),
                "variant": variant.get("title", ""),
                "price": float(variant.get("price", 0)),
                "inventory": int(variant.get("inventory_quantity", 0)),
                "sku": variant.get("sku", ""),
                "product_type": product_type,
                "vendor": vendor,
            })
    return pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["product", "variant", "price", "inventory", "sku", "product_type", "vendor"]
    )


def customers_to_dataframe(customers: list[dict]) -> pd.DataFrame:
    rows: list[dict] = []
    for c in customers:
        rows.append({
            "customer_id": str(c.get("id", "")),
            "email": c.get("email", ""),
            "country": c.get("default_address", {}).get("country", "") if c.get("default_address") else "",
            "orders_count": int(c.get("orders_count", 0)),
            "total_spent": float(c.get("total_spent", 0)),
        })
    return pd.DataFrame(rows) if rows else pd.DataFrame(
        columns=["customer_id", "email", "country", "orders_count", "total_spent"]
    )


def build_combined_dataframe(
    orders: list[dict],
    products: list[dict] | None = None,
) -> pd.DataFrame:
    """Build the primary analysis DataFrame from Shopify data.

    Returns order-level data enriched with product info.
    This matches the expected columns (revenue, product, region, quantity, date)
    that the existing analysis pipeline recognizes.
    """
    df = orders_to_dataframe(orders)
    if df.empty:
        return df

    if products:
        prod_df = products_to_dataframe(products)
        if not prod_df.empty:
            price_map = (
                prod_df.groupby("product")["price"].mean().to_dict()
            )
            inventory_map = (
                prod_df.groupby("product")["inventory"].sum().to_dict()
            )
            df["list_price"] = df["product"].map(price_map).fillna(0)
            df["inventory"] = df["product"].map(inventory_map).fillna(0)

    return df


# ── Source record builder ─────────────────────────────────────────────────────

def build_shopify_source_record(
    source_name: str,
    shop_domain: str,
    access_token: str,
    refresh_interval: int,
    user_id: str,
    source_id: str,
    store_info: dict | None = None,
    file_id: Optional[str] = None,
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    return {
        "source_id": source_id,
        "source_type": "shopify",
        "source_name": source_name,
        "shop_domain": shop_domain,
        "access_token": access_token,
        "store_info": store_info or {},
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
