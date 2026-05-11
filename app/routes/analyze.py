from fastapi import APIRouter, Depends, HTTPException

from app.analysis.analyzer import analyze_dataframe
from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter()


def build_analysis_response(file_doc, df):
    return {
        "file_id": file_doc["file_id"],
        "filename": file_doc.get("filename"),
        "uploaded_at": file_doc.get("created_at"),
        "analysis": analyze_dataframe(df),
    }


@router.post("/analyze-file/{file_id}")
def analyze_file(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return build_analysis_response(file_doc, load_dataframe(file_doc["path"]))


@router.get("/analysis/{file_id}")
def get_analysis(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    return build_analysis_response(file_doc, load_dataframe(file_doc["path"]))
