from fastapi import APIRouter, HTTPException

from laplace.models.schemas import (
    FREQUENCY_MAP,
    ForecastRequest,
    ForecastResponse,
)
from laplace.services.forecasting import run_all_models, run_chronos, run_statsforecast

router = APIRouter(prefix="/api", tags=["forecast"])


@router.post("/forecast", response_model=ForecastResponse)
async def forecast(request: ForecastRequest) -> ForecastResponse:
    n = len(request.values)
    if n < 10:
        raise HTTPException(status_code=422, detail="Need at least 10 data points")

    freq_info = FREQUENCY_MAP[request.frequency]
    horizon = request.horizon or freq_info.horizon_default

    max_horizon = min(n // 3, n - freq_info.period)
    if horizon > max_horizon:
        raise HTTPException(
            status_code=422,
            detail=f"Horizon {horizon} too large for {n} points (max: {max_horizon})",
        )

    if request.model_name:
        if request.model_name == "Chronos-Bolt":
            forecasts = [run_chronos(request.values, horizon)]
        else:
            sf_results = run_statsforecast(request.values, horizon, request.frequency)
            forecasts = [r for r in sf_results if r.model_name == request.model_name]
            if not forecasts:
                raise HTTPException(
                    status_code=422,
                    detail=f"Unknown model: {request.model_name}",
                )
    else:
        forecasts = run_all_models(request.values, horizon, request.frequency)

    if not forecasts:
        raise HTTPException(status_code=500, detail="All models failed")

    return ForecastResponse(
        forecasts=forecasts,
        horizon=horizon,
        frequency=request.frequency,
    )
