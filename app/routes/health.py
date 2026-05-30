"""Business health score endpoints."""
import logging
import time

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user, kv_get, kv_set

router = APIRouter(prefix="/health-score", tags=["health"])
logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 3600


@router.get("/{file_id}")
def get_health_score(file_id: str, wu: dict = Depends(get_workspace_user)):
    owner_id = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, owner_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    cache_key = f"health_score_{file_id}"
    cached = kv_get(cache_key)
    if cached and time.time() - cached.get("_cached_at", 0) < _CACHE_TTL_SECONDS:
        return {"file_id": file_id, "scores": cached["scores"], "cached": True}

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.analysis.analyzer import analyze_dataframe
        from app.services.health_score_service import calculate_health_scores
        analysis = analyze_dataframe(df)
        scores = calculate_health_scores(df, analysis)
        kv_set(cache_key, {"scores": scores, "_cached_at": time.time()})
        return {"file_id": file_id, "scores": scores, "cached": False}
    except Exception as exc:
        logger.exception("Health score failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Health score calculation failed: {exc}")


@router.delete("/{file_id}/cache")
def clear_health_cache(file_id: str, wu: dict = Depends(get_workspace_user)):
    from app.storage import kv_delete
    owner_id = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, owner_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    kv_delete(f"health_score_{file_id}")
    return {"success": True}
