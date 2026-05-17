from fastapi import APIRouter, HTTPException

from laplace.models.schemas import (
    ACFResult,
    DiagnosticsRequest,
    DiagnosticsResponse,
    ForecastabilityDimension,
    ForecastabilityResult,
    STLResult,
)
from laplace.services.diagnostics import compute_acf_pacf, compute_forecastability, compute_stl

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.post("", response_model=DiagnosticsResponse)
async def run_diagnostics(request: DiagnosticsRequest):
    if len(request.values) < 10:
        raise HTTPException(status_code=422, detail="Need at least 10 data points for diagnostics")

    stl_raw = compute_stl(request.values, request.frequency)
    acf_raw = compute_acf_pacf(request.values)
    forecast_raw = compute_forecastability(request.values, request.frequency)

    stl = STLResult(
        observed=stl_raw["observed"],
        trend=stl_raw["trend"],
        seasonal=stl_raw["seasonal"],
        residual=stl_raw["residual"],
    )

    acf_pacf = ACFResult(
        acf_values=acf_raw["acf_values"],
        pacf_values=acf_raw["pacf_values"],
        ci_upper=acf_raw["ci_upper"],
        ci_lower=acf_raw["ci_lower"],
        lags=acf_raw["lags"],
    )

    forecastability = ForecastabilityResult(
        total_score=forecast_raw["total_score"],
        interpretation=forecast_raw["interpretation"],
        dimensions=[ForecastabilityDimension(**d) for d in forecast_raw["dimensions"]],
        details=forecast_raw["details"],
    )

    return DiagnosticsResponse(stl=stl, acf_pacf=acf_pacf, forecastability=forecastability)
