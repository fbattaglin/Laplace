from fastapi import APIRouter, HTTPException

from laplace.models.schemas import (
    FREQUENCY_MAP,
    BacktestRequest,
    BacktestResponse,
)
from laplace.services.backtest import rolling_origin_cv

router = APIRouter(prefix="/api", tags=["backtest"])


@router.post("/backtest", response_model=BacktestResponse)
async def backtest(request: BacktestRequest) -> BacktestResponse:
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

    try:
        result = rolling_origin_cv(
            values=request.values,
            frequency=request.frequency,
            horizon=horizon,
            n_splits=request.n_splits,
            covariates=request.covariates,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from None

    return result
