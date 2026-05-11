from fastapi import APIRouter, Depends, HTTPException

from app.ai.insight_generator import generate_business_insights
from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter()


@router.get("/insights/{file_id}")
def get_insights(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    df = load_dataframe(file_doc["path"])
    industry = file_doc.get("industry")
    return generate_business_insights(df, industry=industry)
