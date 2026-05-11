from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.chat.query_engine import answer_question
from app.dataframe_utils import load_dataframe
from app.storage import get_file_record

router = APIRouter()


class Question(BaseModel):
    question: str


@router.post("/ask/{file_id}")
def ask_question(file_id: str, q: Question):
    file_doc = get_file_record(file_id)
    if not file_doc:
        raise HTTPException(status_code=404, detail="file not found")
    answer = answer_question(load_dataframe(file_doc["path"]), q.question)
    return {"question": q.question, "answer": answer}
