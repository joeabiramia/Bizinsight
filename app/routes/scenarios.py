"""Scenario simulation (What-If) endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user

router = APIRouter(prefix="/scenarios", tags=["scenarios"])
logger = logging.getLogger(__name__)


class ScenarioRequest(BaseModel):
    price_change_pct: float = 0.0
    volume_change_pct: float = 0.0
    marketing_change_pct: float = 0.0
    staff_change_pct: float = 0.0
    cost_change_pct: float = 0.0


@router.post("/{file_id}/simulate")
def simulate_scenario(
    file_id: str,
    scenario: ScenarioRequest,
    current_user: dict = Depends(get_current_user),
):
    """Run a what-if scenario simulation against the dataset."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")

    try:
        from app.services.scenario_service import simulate_scenario as _simulate
        result = _simulate(df, scenario.model_dump())
        return result
    except Exception as exc:
        logger.exception("Scenario simulation failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Simulation failed: {exc}")
