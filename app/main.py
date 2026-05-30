import logging
import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv()

from app.routes.ai_chat import router as ai_router
from app.routes.analyze import router as analyze_router
from app.routes.anomalies import router as anomalies_router
from app.routes.anomaly_explain import router as anomaly_explain_router
from app.routes.workspace import router as workspace_router
from app.routes.digest import router as digest_router
from app.routes.audit import router as audit_router
from app.routes.auth import router as auth_router
from app.routes.automation import router as automation_router
from app.routes.chart_ai import router as chart_ai_router
from app.routes.charts import router as charts_router
from app.routes.chat import router as chat_router
from app.routes.chat_history import router as chat_history_router
from app.routes.compare import router as compare_router
from app.routes.data_cleaning import router as data_cleaning_router
from app.routes.fraud import router as fraud_router
from app.routes.goal_forecast import router as goal_forecast_router
from app.routes.goals import router as goals_router
from app.routes.health import router as health_router
from app.routes.insights import router as insights_router
from app.routes.market_intel import router as market_intel_router
from app.routes.notifications import router as notifications_router
from app.routes.predictions import router as predictions_router
from app.routes.alerts import router as alerts_router
from app.routes.business_monitor import router as business_monitor_router
from app.routes.excel_online import router as excel_online_router
from app.routes.live_sources import router as live_sources_router
from app.routes.share import router as share_router
from app.routes.shopify_connect import router as shopify_router
from app.routes.realtime import router as realtime_router
from app.routes.reports import router as reports_router
from app.routes.scenarios import router as scenarios_router
from app.routes.strategy import router as strategy_router
from app.routes.upload import router as upload_router
from fastapi import HTTPException
from app.storage import storage_status

_COMING_SOON_MSG = (
    "Live Data functionality is currently under development and will be available in a future release."
)


def _live_data_disabled():
    raise HTTPException(status_code=503, detail=_COMING_SOON_MSG)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        # 1. Process digest jobs that became due while offline
        from app.routes.digest import start_scheduler, _process_scheduled_jobs
        _process_scheduled_jobs()
        start_scheduler()
    except Exception as exc:
        logger.warning("Digest scheduler startup failed: %s", exc)

    try:
        # 2. Clean up expired password-reset tokens from KV store
        import time as _time
        from app.storage import kv_get, kv_set
        jobs = kv_get("digest_scheduled_jobs") or []
        reset_keys = [k for k in (kv_get("_pwd_reset_index") or []) ]
        now = _time.time()
        cleaned = 0
        for token_key in reset_keys:
            record = kv_get(token_key)
            if record and record.get("expires_at", 0) < now:
                from app.storage import kv_delete
                kv_delete(token_key)
                cleaned += 1
        if cleaned:
            logger.info("Cleaned %d expired password-reset tokens", cleaned)
    except Exception as exc:
        logger.warning("Token cleanup failed: %s", exc)

    try:
        # 3. Grandfather existing users: anyone created before email_verified field
        #    was introduced gets marked as verified so they don't see the banner.
        from app.storage import _load_users, _save_users
        users = _load_users()
        changed = False
        for u in users:
            if "email_verified" not in u:
                u["email_verified"] = True   # trust existing accounts
                changed = True
        if changed:
            _save_users(users)
            logger.info("Grandfathered %d existing users as email-verified",
                        sum(1 for u in users if u.get("email_verified")))
        # Same for MongoDB
        from app.storage import _mongo_available, _users_collection
        if _mongo_available():
            try:
                _users_collection.update_many(
                    {"email_verified": {"$exists": False}},
                    {"$set": {"email_verified": True}},
                )
            except Exception:
                pass
    except Exception as exc:
        logger.warning("User grandfathering failed: %s", exc)

    yield


app = FastAPI(title="BizInsight AI", version="3.0.0", lifespan=lifespan)

allowed_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in allowed_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    origin = request.headers.get("origin", "")
    headers = {}
    if origin in [o.strip() for o in allowed_origins]:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."},
        headers=headers,
    )


# ── Phase 1 ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(analyze_router)
app.include_router(charts_router)
app.include_router(insights_router)
app.include_router(chat_router)
app.include_router(ai_router)
app.include_router(reports_router)
app.include_router(notifications_router)
app.include_router(predictions_router)
app.include_router(health_router)
app.include_router(scenarios_router)
app.include_router(anomalies_router)

# ── Phase 2 ───────────────────────────────────────────────────────────────────
app.include_router(data_cleaning_router)
app.include_router(automation_router)
app.include_router(strategy_router)
app.include_router(goals_router)
app.include_router(fraud_router)
app.include_router(market_intel_router)
app.include_router(audit_router)
from fastapi import Depends
app.include_router(realtime_router, dependencies=[Depends(_live_data_disabled)])
app.include_router(live_sources_router, dependencies=[Depends(_live_data_disabled)])
app.include_router(excel_online_router, dependencies=[Depends(_live_data_disabled)])
app.include_router(shopify_router, dependencies=[Depends(_live_data_disabled)])
app.include_router(alerts_router)
app.include_router(business_monitor_router)

# ── Phase 3 — New features ────────────────────────────────────────────────────
app.include_router(share_router)
app.include_router(chat_history_router)
app.include_router(compare_router)
app.include_router(chart_ai_router)
app.include_router(goal_forecast_router)
app.include_router(anomaly_explain_router)

# ── Phase 5 — Team, Digest, Benchmark ─────────────────────────────────────────
app.include_router(workspace_router)
app.include_router(digest_router)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5432/bizinsight",
)
_pg_engine = None


def _get_pg_engine():
    global _pg_engine
    if _pg_engine is None:
        try:
            from sqlalchemy import create_engine
            _pg_engine = create_engine(DATABASE_URL, pool_pre_ping=True)
        except Exception as exc:
            logger.warning("PostgreSQL engine creation failed: %s", exc)
    return _pg_engine





@app.get("/")
def root():
    return {"message": "BizInsight AI backend running", "version": "3.0.0"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/db-check")
def db_check():
    from sqlalchemy import text
    status = storage_status()
    engine = _get_pg_engine()
    if engine is None:
        status["postgres"] = "engine not initialized"
        return status
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        status["postgres"] = "connected"
    except Exception as exc:
        status["postgres"] = f"not connected: {exc.__class__.__name__}"
    return status
