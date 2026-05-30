"""AI Data Cleaning Assistant endpoints."""
import logging
import os

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/data-cleaning", tags=["data-cleaning"])
logger = logging.getLogger(__name__)

UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")


class ApplyFixRequest(BaseModel):
    fixes: list[dict]


@router.get("/{file_id}/analyze")
def analyze_data_quality(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    """Detect all data quality issues in the dataset."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.services.data_cleaning_service import analyze_data_quality as _analyze
        result = _analyze(df)
        log_action(wu["user_id"], "analysis_run", "file", file_id, {"type": "data_quality"})
        return {"file_id": file_id, **result}
    except Exception as exc:
        logger.exception("Data quality analysis failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")


@router.post("/{file_id}/apply")
def apply_fixes(
    file_id: str,
    body: ApplyFixRequest,
    wu: dict = Depends(get_workspace_user),
):
    """Apply a list of data quality fixes to the dataset and save the cleaned file."""
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    from app.services.data_cleaning_service import apply_fix

    applied: list[str] = []
    for fix in body.fixes:
        try:
            df, description = apply_fix(df, fix)
            applied.append(description)
        except Exception as exc:
            logger.warning("Fix failed (%s): %s", fix.get("suggestion"), exc)
            applied.append(f"Fix skipped: {fix.get('suggestion')} — {exc}")

    # Persist the cleaned file (overwrite in-place)
    try:
        path = file_doc["path"]
        if path.endswith(".csv"):
            df.to_csv(path, index=False)
        else:
            df.to_excel(path, index=False)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not save cleaned file: {exc}")

    log_action(
        wu["user_id"],
        "data_cleaning_applied",
        "file",
        file_id,
        {"fixes_applied": len(applied)},
    )

    # Re-run quality check on cleaned data
    from app.services.data_cleaning_service import analyze_data_quality as _analyze
    new_quality = _analyze(df)

    return {
        "file_id": file_id,
        "fixes_applied": len(applied),
        "descriptions": applied,
        "new_quality": new_quality,
        "message": f"Successfully applied {len(applied)} fix(es). Dataset updated.",
    }
