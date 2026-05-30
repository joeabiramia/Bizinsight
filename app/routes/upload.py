from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import os

from app.dataframe_utils import allowed_filename, load_dataframe, safe_upload_name
from app.dependencies import get_current_user, get_workspace_user, require_analyst, require_admin
from app.services.dataset_classifier import classify_dataset
from app.storage import (
    UPLOAD_FOLDER,
    get_file_record_for_user,
    insert_file_record,
    list_file_records_for_user,
    delete_file_record,
)

router = APIRouter()


def build_preview(filepath):
    df = load_dataframe(filepath)
    return df.head(10).fillna("").to_dict(orient="records")


@router.post("/upload")
@router.post("/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    wu: dict = Depends(require_analyst),   # viewers blocked
):
    current_user = wu
    if not file.filename or not allowed_filename(file.filename):
        raise HTTPException(status_code=415, detail="Only CSV, XLSX, and XLS files are supported")

    file_id = str(uuid4())
    clean_name = safe_upload_name(file.filename)
    filepath = f"{UPLOAD_FOLDER}/{file_id}_{clean_name}"

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    MAX_BYTES = 50 * 1024 * 1024  # 50 MB
    if len(contents) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents) / 1_048_576:.1f} MB). Maximum allowed size is 50 MB.",
        )

    with open(filepath, "wb") as buffer:
        buffer.write(contents)

    preview = build_preview(filepath)
    now = datetime.utcnow()

    # Classify industry immediately so the benchmark page can use it without
    # requiring a separate API call after upload.
    try:
        df_for_classify = load_dataframe(filepath)
        classification = classify_dataset(df_for_classify)
        detected_industry = classification.industry
        industry_confidence = classification.confidence
    except Exception:
        detected_industry = "general"
        industry_confidence = 0.0

    # Store under effective_owner_id so workspace members' uploads
    # belong to the workspace owner's dataset pool
    effective_owner = wu.get("effective_owner_id", wu["user_id"])
    insert_file_record({
        "file_id": file_id,
        "filename": clean_name,
        "path": filepath,
        "user_id": effective_owner,
        "uploaded_by": wu["user_id"],
        "user_email": current_user.get("email", ""),
        "created_at": now,
        "updated_at": now,
        "industry": detected_industry,
        "industry_confidence": industry_confidence,
    })

    return {
        "file_id": file_id,
        "filename": clean_name,
        "preview": preview,
        "industry": detected_industry,
        "industry_confidence": industry_confidence,
    }


def serialize_dataset(entry):
    def serialize_date(value):
        return value.isoformat() if hasattr(value, "isoformat") else value

    return {
        "file_id": entry.get("file_id"),
        "filename": entry.get("filename"),
        "created_at": serialize_date(entry.get("created_at")),
        "updated_at": serialize_date(entry.get("updated_at")),
    }


@router.get("/datasets")
def list_datasets(wu: dict = Depends(get_workspace_user)):
    effective_owner = wu.get("effective_owner_id", wu["user_id"])
    records = list_file_records_for_user(effective_owner)
    return {"datasets": [serialize_dataset(item) for item in records]}


@router.delete("/upload/{file_id}")
def delete_dataset(file_id: str, wu: dict = Depends(require_admin)):
    """Delete a dataset and its associated file. Requires admin or owner role."""
    current_user = wu
    effective_owner = wu.get("effective_owner_id", wu["user_id"])
    file_doc = get_file_record_for_user(file_id, effective_owner)
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    # Remove from disk
    filepath = file_doc.get("path", "")
    if filepath and os.path.exists(filepath):
        try:
            os.remove(filepath)
        except OSError:
            pass  # File already deleted

    # Remove from storage
    delete_file_record(file_id, effective_owner)
    return {"success": True, "file_id": file_id}


@router.get("/dataset-preview/{file_id}")
def get_dataset_preview(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    df = load_dataframe(file_doc["path"])
    return {
        "file_id": file_id,
        "filename": file_doc.get("filename"),
        "shape": {"rows": int(df.shape[0]), "columns": int(df.shape[1])},
        "columns": [str(c) for c in df.columns],
        "preview": df.head(10).fillna("").to_dict(orient="records"),
    }
