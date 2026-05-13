"""Notification Channels — Slack and WhatsApp alert delivery.

Slack:  Uses Incoming Webhooks (no SDK needed).
WhatsApp: Uses Twilio API via urllib (no SDK needed).
         Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM env vars.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from base64 import b64encode

logger = logging.getLogger(__name__)

_TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
_TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
_TWILIO_WA_FROM = os.getenv("TWILIO_WHATSAPP_FROM", "whatsapp:+14155238886")


def send_slack(webhook_url: str, alerts: list[dict], filename: str) -> bool:
    if not webhook_url:
        return False
    if not alerts:
        return False

    high = [a for a in alerts if a.get("severity") == "high"]
    if not high:
        high = alerts[:2]

    blocks = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"🚨 BizInsight Alert — {filename}"},
        }
    ]
    for alert in high[:4]:
        color = {"high": "🔴", "medium": "🟡", "low": "🟢"}.get(alert.get("severity", ""), "⚪")
        blocks.append({
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{color} *{alert.get('title','')}*\n{alert.get('message','')}\n_Action: {alert.get('recommended_action','')}_",
            },
        })

    payload = json.dumps({"blocks": blocks}).encode()
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as exc:
        logger.error("Slack send failed: %s", exc)
        return False


def send_whatsapp(to_number: str, alerts: list[dict], filename: str) -> bool:
    if not _TWILIO_SID or not _TWILIO_TOKEN:
        logger.warning("Twilio credentials not configured — WhatsApp alert not sent")
        return False
    if not alerts:
        return False

    high = [a for a in alerts if a.get("severity") in ("high", "medium")][:3] or alerts[:2]
    lines = [f"🚨 BizInsight Alert — {filename}"]
    for a in high:
        lines.append(f"\n• {a.get('title','')}: {a.get('message','')}")
    body = "\n".join(lines)[:1500]

    to_wa = f"whatsapp:{to_number}" if not to_number.startswith("whatsapp:") else to_number
    data = urllib.parse.urlencode({
        "From": _TWILIO_WA_FROM,
        "To": to_wa,
        "Body": body,
    }).encode()

    url = f"https://api.twilio.com/2010-04-01/Accounts/{_TWILIO_SID}/Messages.json"
    credentials = b64encode(f"{_TWILIO_SID}:{_TWILIO_TOKEN}".encode()).decode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 201)
    except Exception as exc:
        logger.error("WhatsApp send failed: %s", exc)
        return False


def dispatch_alerts(channels: list[dict], alerts: list[dict], filename: str) -> list[dict]:
    """Send alerts to all configured active channels. Returns delivery results."""
    results = []
    for ch in channels:
        if not ch.get("active"):
            continue
        ch_type = ch.get("channel_type", "")
        if ch_type == "slack":
            ok = send_slack(ch.get("webhook_url", ""), alerts, filename)
        elif ch_type == "whatsapp":
            ok = send_whatsapp(ch.get("phone_number", ""), alerts, filename)
        else:
            continue
        results.append({"channel_id": ch.get("channel_id"), "type": ch_type, "sent": ok})
    return results
