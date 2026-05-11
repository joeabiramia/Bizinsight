import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ai_chat import router as ai_router
from app.routes.analyze import router as analyze_router
from app.routes.auth import router as auth_router
from app.routes.charts import router as charts_router
from app.routes.chat import router as chat_router
from app.routes.insights import router as insights_router
from app.routes.upload import router as upload_router
from app.storage import storage_status

logger = logging.getLogger(__name__)

app = FastAPI(title="BizInsight AI", version="1.0.0")

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

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(analyze_router)
app.include_router(charts_router)
app.include_router(insights_router)
app.include_router(chat_router)
app.include_router(ai_router)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/bizinsight")
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
    return {"message": "BizInsight AI backend running", "version": "1.0.0"}


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
