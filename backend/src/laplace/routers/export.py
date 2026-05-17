from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

from laplace.models.schemas import Frequency
from laplace.services.export import append_results_log, generate_xlsx_report

router = APIRouter(prefix="/api/export", tags=["export"])


class ExportRequest(BaseModel):
    data: dict
    diagnostics: dict | None = None
    backtest: dict | None = None
    forecast: dict | None = None


class LogEntry(BaseModel):
    dataset: str
    model: str
    smape: float
    mae: float
    rmse: float
    horizon: int
    forecastability_score: float
    n_observations: int
    frequency: Frequency


@router.post("/xlsx")
async def export_xlsx(request: ExportRequest):
    xlsx_bytes = generate_xlsx_report(
        data=request.data,
        diagnostics=request.diagnostics,
        backtest=request.backtest,
        forecast=request.forecast,
    )

    filename = f"laplace_{request.data.get('name', 'report')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/log")
async def save_to_log(entry: LogEntry):
    path = append_results_log(entry.model_dump())
    return {"status": "ok", "path": path}
