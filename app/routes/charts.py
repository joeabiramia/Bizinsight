from fastapi import APIRouter, HTTPException

from app.dataframe_utils import load_dataframe
from app.storage import get_file_record
from app.visualization.chart_generator import generate_charts

router = APIRouter()


@router.get("/charts/{file_id}")
def get_charts(file_id: str):
    file_doc = get_file_record(file_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="file not found")
    return {"charts": generate_charts(load_dataframe(file_doc["path"]))}
