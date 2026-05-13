"""Market Intelligence endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException

from app.dataframe_utils import load_dataframe
from app.dependencies import get_current_user
from app.storage import get_file_record_for_user
from app.services.audit_service import log_action

router = APIRouter(prefix="/market-intel", tags=["market-intel"])
logger = logging.getLogger(__name__)


@router.get("/summary")
def get_market_summary(
    industry: str = "",
    current_user: dict = Depends(get_current_user),
):
    """Get market intelligence for an industry."""
    from app.services.market_intel_service import get_market_intelligence
    result = get_market_intelligence(industry or None)
    log_action(current_user["user_id"], "market_intel_viewed", "market", "", {"industry": industry})
    return result


@router.get("/{file_id}/insights")
def get_contextual_market_insights(
    file_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Get market intelligence contextualized to a user's dataset and industry."""
    file_doc = get_file_record_for_user(file_id, current_user["user_id"])
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")

    industry = file_doc.get("industry") or ""

    from app.services.market_intel_service import get_market_intelligence, get_contextual_recommendations
    intel = get_market_intelligence(industry or None)
    recs = get_contextual_recommendations(industry or None)
    log_action(
        current_user["user_id"],
        "market_intel_viewed",
        "file",
        file_id,
        {"industry": industry},
    )
    return {
        "file_id": file_id,
        "industry": industry or "General",
        **intel,
        "contextual_recommendations": recs,
    }
