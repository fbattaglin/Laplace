from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from laplace.models.schemas import PreprocessedResult, PreprocessingConfig
from laplace.services.preprocessing import apply_preprocessing

router = APIRouter(prefix="/api/preprocessing", tags=["preprocessing"])


class PreprocessRequest(BaseModel):
    values: list[float]
    dates: list[str]
    config: PreprocessingConfig


@router.post("", response_model=PreprocessedResult)
async def preprocess(req: PreprocessRequest) -> PreprocessedResult:
    if len(req.values) < 10:
        raise HTTPException(status_code=422, detail="Need at least 10 data points to preprocess.")

    if len(req.values) != len(req.dates):
        raise HTTPException(status_code=422, detail="values and dates must have the same length.")

    try:
        result = apply_preprocessing(req.values, req.dates, req.config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preprocessing failed: {e}") from e

    if len(result.values) < 10:
        raise HTTPException(
            status_code=422,
            detail="After preprocessing, fewer than 10 points remain. Try a lower differencing order."
        )

    return result
