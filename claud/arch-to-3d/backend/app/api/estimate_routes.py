"""API endpoints for exterior construction cost estimation."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.models.estimate_schemas import CsvExportRequest, PdfAnalysisResponse
from app.services.csv_exporter import export_csv
from app.services.estimate_analyzer import analyze_pdf

router = APIRouter(prefix="/api/estimate")


@router.post("/analyze-pdf", response_model=PdfAnalysisResponse)
async def analyze_exterior_pdf(pdf: UploadFile = File(...)):
    """Upload an exterior construction PDF for AI analysis."""
    if not pdf.filename or not pdf.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="PDFファイルをアップロードしてください。")

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / "upload.pdf"
            temp_path.write_bytes(await pdf.read())
            return analyze_pdf(temp_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"PDF解析エラー: {exc}") from exc


@router.post("/export-csv")
async def export_estimate_csv(project: CsvExportRequest):
    """Export estimation data as a Shift-JIS CSV file."""
    try:
        csv_bytes = export_csv(project)
        filename = f"gaiko_estimate_{project.name or 'export'}.csv"
        return Response(
            content=csv_bytes,
            media_type="text/csv; charset=Shift_JIS",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"CSV出力エラー: {exc}") from exc
