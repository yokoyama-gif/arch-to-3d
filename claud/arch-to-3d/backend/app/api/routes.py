"""API endpoints for preliminary sky factor studies and drawing import."""

from pathlib import Path
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import DrawingImportResponse, SkyFactorRequest, SkyFactorResponse
from app.services.drawing_import import DrawingImportError, DrawingImportService
from app.services.sky_factor import SkyFactorService

router = APIRouter(prefix="/api")
sky_factor_service = SkyFactorService()
drawing_import_service = DrawingImportService()


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.post("/skyfactor/analyze", response_model=SkyFactorResponse)
async def analyze_sky_factor(request: SkyFactorRequest):
    return sky_factor_service.analyze(request)


@router.post("/import/drawing", response_model=DrawingImportResponse)
async def import_drawing(
    drawing: UploadFile = File(...),
    unit: str = Form("mm"),
    default_planned_height: float = Form(12.0),
    default_context_height: float = Form(9.0),
):
    suffix = Path(drawing.filename or "drawing").suffix.lower()

    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir) / f"upload{suffix or '.dat'}"
            temp_path.write_bytes(await drawing.read())
            return drawing_import_service.import_drawing(
                temp_path,
                unit=unit,
                default_planned_height=default_planned_height,
                default_context_height=default_context_height,
            )
    except DrawingImportError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
