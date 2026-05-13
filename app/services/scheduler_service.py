"""Background Scheduler Service.

Uses APScheduler to fire email reports on user-defined schedules.
Schedules are stored in the database and loaded on app startup.

Schedule frequencies:
  daily   — every day at HH:MM UTC
  weekly  — every week on day_of_week (0=Mon … 6=Sun) at HH:MM UTC
  monthly — every month on day_of_month at HH:MM UTC
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

_scheduler = None


def get_scheduler():
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.schedulers.background import BackgroundScheduler
            _scheduler = BackgroundScheduler(timezone="UTC")
        except ImportError:
            logger.warning("APScheduler not installed — scheduled emails disabled. Run: pip install apscheduler")
    return _scheduler


def start_scheduler():
    s = get_scheduler()
    if s and not s.running:
        s.start()
        logger.info("Background scheduler started")


def stop_scheduler():
    s = get_scheduler()
    if s and s.running:
        s.shutdown(wait=False)


def _run_schedule(schedule_id: str):
    """Execute one schedule: fetch data, build email, send."""
    try:
        from app.storage import get_schedule, update_schedule
        from app.storage import get_file_record
        from app.dataframe_utils import load_dataframe
        from app.services.email_service import send_email, build_report_email, is_configured
        from app.monitoring.alert_engine import generate_alerts

        if not is_configured():
            return

        schedule = get_schedule(schedule_id)
        if not schedule or not schedule.get("active"):
            return

        file_id = schedule.get("file_id")
        if not file_id:
            return

        file_doc = get_file_record(file_id)
        if not file_doc:
            return

        df = load_dataframe(file_doc["path"])
        alerts = generate_alerts(df)

        from app.services.health_score_service import calculate_health_scores
        health = calculate_health_scores(df)
        pulse = "positive" if health.get("overall_score", 50) >= 70 else "negative" if health.get("overall_score", 50) < 40 else "stable"

        # Build KPI list from numeric summary
        kpis: list[dict] = []
        for col in df.select_dtypes(include="number").columns[:6]:
            from app.dataframe_utils import safe_number
            vals = df[col].apply(safe_number).dropna()
            if vals.empty:
                continue
            kpis.append({
                "metric": col,
                "total": f"{vals.sum():,.0f}",
                "trend": "up" if len(vals) >= 2 and vals.iloc[-1] > vals.iloc[-2] else "down",
                "change_pct": float((vals.iloc[-1] - vals.iloc[-2]) / abs(vals.iloc[-2]) * 100) if len(vals) >= 2 and vals.iloc[-2] != 0 else 0.0,
            })

        dashboard_url = schedule.get("dashboard_url", "http://localhost:5173/dashboard")
        filename = file_doc.get("filename", "Your dataset")
        recipient = schedule.get("email")

        html = build_report_email(
            recipient_name=schedule.get("recipient_name", ""),
            filename=filename,
            kpis=kpis,
            insights=[a["title"] + ": " + a["message"] for a in alerts[:3]],
            alerts=[a for a in alerts if a["severity"] in ("high", "medium")][:3],
            dashboard_url=dashboard_url,
            pulse=pulse,
        )

        sent = send_email(recipient, f"BizInsight Report — {filename}", html)
        now = datetime.now(timezone.utc).isoformat()
        update_schedule(schedule_id, {"last_sent_at": now, "last_status": "sent" if sent else "failed"})
    except Exception as exc:
        logger.error("Schedule %s failed: %s", schedule_id, exc)
        try:
            from app.storage import update_schedule
            update_schedule(schedule_id, {"last_status": f"error: {exc}"})
        except Exception:
            pass


def register_schedule(schedule: dict):
    """Add or replace a job in APScheduler."""
    s = get_scheduler()
    if not s:
        return

    sid = schedule["schedule_id"]
    freq = schedule.get("frequency", "daily")
    time_str = schedule.get("time_of_day", "08:00")
    try:
        hour, minute = int(time_str.split(":")[0]), int(time_str.split(":")[1])
    except Exception:
        hour, minute = 8, 0

    job_id = f"report_{sid}"
    try:
        s.remove_job(job_id)
    except Exception:
        pass

    if not schedule.get("active", True):
        return

    if freq == "daily":
        s.add_job(_run_schedule, "cron", hour=hour, minute=minute, id=job_id, args=[sid])
    elif freq == "weekly":
        dow = schedule.get("day_of_week", 0)
        s.add_job(_run_schedule, "cron", day_of_week=dow, hour=hour, minute=minute, id=job_id, args=[sid])
    elif freq == "monthly":
        dom = schedule.get("day_of_month", 1)
        s.add_job(_run_schedule, "cron", day=dom, hour=hour, minute=minute, id=job_id, args=[sid])

    logger.info("Registered schedule %s (%s at %s)", sid, freq, time_str)


def unregister_schedule(schedule_id: str):
    s = get_scheduler()
    if not s:
        return
    try:
        s.remove_job(f"report_{schedule_id}")
    except Exception:
        pass


def load_all_schedules():
    """Called on app startup — re-register all active schedules."""
    try:
        from app.storage import list_all_schedules
        for sched in list_all_schedules():
            if sched.get("active"):
                register_schedule(sched)
        logger.info("Loaded all persisted schedules into APScheduler")
    except Exception as exc:
        logger.warning("Could not load schedules on startup: %s", exc)
