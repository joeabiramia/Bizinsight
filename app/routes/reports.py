"""Report export endpoints — PDF, PPTX, Excel."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.analysis.analyzer import analyze_dataframe
from app.ai.insight_generator import generate_business_insights
from app.dataframe_utils import load_dataframe
from app.dependencies import get_workspace_user
from app.storage import get_file_record_for_user

router = APIRouter(prefix="/reports", tags=["reports"])
logger = logging.getLogger(__name__)


def _get_df_analysis_insights(file_id: str, wu: dict):
    file_doc = get_file_record_for_user(file_id, wu.get("effective_owner_id", wu["user_id"]))
    if not file_doc:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        df = load_dataframe(file_doc["path"])
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not load file: {exc}")
    analysis = analyze_dataframe(df)
    insights_report = generate_business_insights(df, analysis, analysis.get("industry"))
    insights = insights_report if isinstance(insights_report, list) else insights_report.get("insights", [])
    return df, analysis, insights


@router.get("/{file_id}/pdf")
def download_pdf_report(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    df, analysis, insights = _get_df_analysis_insights(file_id, wu)
    try:
        from app.services.report_service import generate_pdf_report
        pdf_bytes = generate_pdf_report(df, analysis, insights, file_id)
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("PDF generation failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {exc}")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="bizinsight_report_{file_id[:8]}.pdf"'},
    )


@router.get("/{file_id}/pptx")
def download_pptx_report(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    df, analysis, insights = _get_df_analysis_insights(file_id, wu)
    try:
        from app.services.report_service import generate_pptx_report
        pptx_bytes = generate_pptx_report(df, analysis, insights, file_id)
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("PPTX generation failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"PPTX generation failed: {exc}")

    return Response(
        content=pptx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="bizinsight_report_{file_id[:8]}.pptx"'},
    )


@router.get("/{file_id}/excel")
def download_excel_report(
    file_id: str,
    wu: dict = Depends(get_workspace_user),
):
    df, analysis, insights = _get_df_analysis_insights(file_id, wu)
    try:
        from app.services.report_service import generate_excel_report
        excel_bytes = generate_excel_report(df, analysis, insights, file_id)
    except ImportError as exc:
        raise HTTPException(status_code=501, detail=str(exc))
    except Exception as exc:
        logger.exception("Excel generation failed for %s", file_id)
        raise HTTPException(status_code=500, detail=f"Excel generation failed: {exc}")

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="bizinsight_report_{file_id[:8]}.xlsx"'},
    )
