import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes.ai_chat import router as ai_router
from app.routes.analyze import router as analyze_router
from app.routes.anomalies import router as anomalies_router
from app.routes.audit import router as audit_router
from app.routes.auth import router as auth_router
from app.routes.automation import router as automation_router
from app.routes.charts import router as charts_router
from app.routes.chat import router as chat_router
from app.routes.data_cleaning import router as data_cleaning_router
from app.routes.fraud import router as fraud_router
from app.routes.goals import router as goals_router
from app.routes.health import router as health_router
from app.routes.insights import router as insights_router
from app.routes.market_intel import router as market_intel_router
from app.routes.notifications import router as notifications_router
from app.routes.predictions import router as predictions_router
from app.routes.realtime import router as realtime_router
from app.routes.reports import router as reports_router
from app.routes.scenarios import router as scenarios_router
from app.routes.strategy import router as strategy_router
from app.routes.upload import router as upload_router
from app.storage import storage_status

logger = logging.getLogger(__name__)

app = FastAPI(title="BizInsight AI", version="2.0.0")

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
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected server error occurred."},
    )


# ── Phase 1 routers ───────────────────────────────────────────────────────────
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

# ── Phase 2 routers ───────────────────────────────────────────────────────────
app.include_router(data_cleaning_router)
app.include_router(automation_router)
app.include_router(strategy_router)
app.include_router(goals_router)
app.include_router(fraud_router)
app.include_router(market_intel_router)
app.include_router(audit_router)
app.include_router(realtime_router)

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
    return {"message": "BizInsight AI backend running", "version": "2.0.0"}


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
