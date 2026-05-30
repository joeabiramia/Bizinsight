import time

from fastapi import APIRouter, Depends, HTTPException

from app.analysis.analyzer import analyze_dataframe
from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user, get_workspace_user, require_analyst
from app.services.dataset_classifier import classify_dataset
from app.storage import get_file_record_for_user, kv_get, kv_set

router = APIRouter()

_ANALYSIS_CACHE_TTL = 3600  # 1 hour


def _cache_key(file_id: str) -> str:
    return f"analysis_{file_id}"


def build_analysis_response(file_doc, df, use_cache: bool = True):
    file_id = file_doc["file_id"]
    cache_key = _cache_key(file_id)

    if use_cache:
        cached = kv_get(cache_key)
        if cached and time.time() - cached.get("_cached_at", 0) < _ANALYSIS_CACHE_TTL:
            return {
                "file_id": file_id,
                "filename": file_doc.get("filename"),
                "uploaded_at": file_doc.get("created_at"),
                "analysis": cached["analysis"],
                "cached": True,
            }

    analysis = analyze_dataframe(df)
    kv_set(cache_key, {"analysis": analysis, "_cached_at": time.time()})
    return {
        "file_id": file_id,
        "filename": file_doc.get("filename"),
        "uploaded_at": file_doc.get("created_at"),
        "analysis": analysis,
        "cached": False,
    }


@router.post("/analyze-file/{file_id}")
def analyze_file(
    file_id: str,
    wu: dict = Depends(require_analyst),   # viewers blocked from re-analysis
):
    """Force re-analysis, bypass cache and write fresh result."""
    owner_id = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, owner_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    df = load_dataframe(file_doc["path"])
    return build_analysis_response(file_doc, df, use_cache=False)


@router.get("/analysis/{file_id}")
def get_analysis(
    file_id: str,
    wu: dict = Depends(get_workspace_user),   # all roles can view
):
    """Return analysis, serving from cache when available."""
    owner_id = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, owner_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    df = load_dataframe(file_doc["path"])
    return build_analysis_response(file_doc, df, use_cache=True)


@router.get("/classify/{file_id}")
def classify_file(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Classify the dataset's industry domain and return confidence scores."""
    owner_id = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, owner_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    df = load_dataframe(file_doc["path"])
    result = classify_dataset(df)
    return {
        "file_id": file_id,
        "filename": file_doc.get("filename"),
        "industry": result.industry,
        "label": result.label,
        "icon": result.icon,
        "confidence": result.confidence,
        "scores": result.scores,
    }
