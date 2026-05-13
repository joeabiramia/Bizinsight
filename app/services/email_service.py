"""Email Service — SMTP-based report delivery.

Environment variables:
  SMTP_HOST     default: smtp.gmail.com
  SMTP_PORT     default: 587
  SMTP_USER     sender email address
  SMTP_PASS     sender password / app-password
  SMTP_FROM     display name (optional)
"""
from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
_PORT = int(os.getenv("SMTP_PORT", "587"))
_USER = os.getenv("SMTP_USER", "")
_PASS = os.getenv("SMTP_PASS", "")
_FROM = os.getenv("SMTP_FROM", "BizInsight AI <noreply@bizinsight.ai>")


def is_configured() -> bool:
    return bool(_USER and _PASS)


def send_email(to: str, subject: str, html_body: str) -> bool:
    if not is_configured():
        logger.warning("SMTP not configured — email not sent to %s", to)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = _FROM or _USER
        msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(_HOST, _PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(_USER, _PASS)
            server.sendmail(_USER, to, msg.as_string())
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send email to %s: %s", to, exc)
        return False


def build_report_email(
    recipient_name: str,
    filename: str,
    kpis: list[dict],
    insights: list[str],
    alerts: list[dict],
    dashboard_url: str,
    pulse: str = "stable",
) -> str:
    pulse_color = {"positive": "#22c55e", "stable": "#3b82f6", "negative": "#ef4444"}.get(pulse, "#3b82f6")
    pulse_label = {"positive": "Strong Growth", "stable": "Stable", "negative": "Needs Attention"}.get(pulse, "Stable")

    kpi_rows = "".join(
        f"""<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#94a3b8;font-size:13px;">{k.get('metric','')}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;color:#f1f5f9;font-weight:600;font-size:13px;text-align:right;">
            {k.get('total', k.get('value','—'))}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #1e1e2e;text-align:right;">
            <span style="color:{'#22c55e' if k.get('trend')=='up' else '#ef4444'};font-size:12px;font-weight:600;">
              {'▲' if k.get('trend')=='up' else '▼'} {abs(k.get('change_pct',0)):.1f}%
            </span>
          </td>
        </tr>"""
        for k in kpis[:6]
    )

    insight_items = "".join(
        f'<li style="margin-bottom:8px;color:#cbd5e1;font-size:13px;line-height:1.6;">{i}</li>'
        for i in insights[:3]
    )

    alert_items = "".join(
        f"""<div style="background:{'rgba(239,68,68,0.1)' if a.get('severity')=='high' else 'rgba(245,158,11,0.08)'};
                       border-left:3px solid {'#ef4444' if a.get('severity')=='high' else '#f59e0b'};
                       border-radius:4px;padding:10px 14px;margin-bottom:8px;">
          <p style="margin:0;font-weight:600;font-size:13px;color:#f1f5f9;">{a.get('title','')}</p>
          <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">{a.get('recommended_action','')}</p>
        </div>"""
        for a in alerts[:3]
    )

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="background:#0a0a14;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e1e2e,#16213e);border:1px solid #2d2d3d;border-radius:16px;padding:28px;margin-bottom:16px;text-align:center;">
      <div style="display:inline-block;background:#6366f1;color:#fff;font-size:11px;font-weight:800;padding:3px 12px;border-radius:20px;letter-spacing:0.1em;margin-bottom:16px;">BIZINSIGHT AI</div>
      <h1 style="margin:0 0 6px;color:#f1f5f9;font-size:22px;">Scheduled Business Report</h1>
      <p style="margin:0;color:#64748b;font-size:13px;">{filename}</p>
      <div style="margin-top:16px;display:inline-block;background:{pulse_color}18;border:1px solid {pulse_color}40;border-radius:24px;padding:6px 18px;">
        <span style="color:{pulse_color};font-weight:700;font-size:13px;">● {pulse_label}</span>
      </div>
    </div>

    <!-- KPIs -->
    {"" if not kpis else f'''<div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="margin:0 0 14px;color:#f1f5f9;font-size:15px;font-weight:700;">Live KPIs</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:6px 12px;text-align:left;color:#475569;font-size:11px;text-transform:uppercase;font-weight:700;">Metric</th>
          <th style="padding:6px 12px;text-align:right;color:#475569;font-size:11px;text-transform:uppercase;font-weight:700;">Value</th>
          <th style="padding:6px 12px;text-align:right;color:#475569;font-size:11px;text-transform:uppercase;font-weight:700;">Trend</th>
        </tr></thead>
        <tbody>{kpi_rows}</tbody>
      </table>
    </div>'''}

    <!-- Alerts -->
    {"" if not alerts else f'''<div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="margin:0 0 14px;color:#f1f5f9;font-size:15px;font-weight:700;">⚠ Active Alerts</h2>
      {alert_items}
    </div>'''}

    <!-- Insights -->
    {"" if not insights else f'''<div style="background:#1e1e2e;border:1px solid #2d2d3d;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h2 style="margin:0 0 14px;color:#f1f5f9;font-size:15px;font-weight:700;">AI Insights</h2>
      <ul style="margin:0;padding-left:18px;">{insight_items}</ul>
    </div>'''}

    <!-- CTA -->
    <div style="text-align:center;padding:20px;">
      <a href="{dashboard_url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px;display:inline-block;">
        Open Live Dashboard →
      </a>
      <p style="margin:16px 0 0;color:#475569;font-size:11px;">
        You're receiving this because you scheduled it in BizInsight AI.
      </p>
    </div>

  </div>
</body>
</html>"""
