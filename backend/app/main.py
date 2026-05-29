import math
import logging
from typing import Any
import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.routers import datasets, diagnostics, validation, preprocessing, forecast

# Initialize structured logging
setup_logging()
logger = logging.getLogger("laplace.main")

app = FastAPI(title="Laplace API", description="Converged Production-Grade Time Series Forecasting Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sanitize_float_values(obj: Any) -> Any:
    """
    Recursively replaces NaN and Inf float values in lists and dicts with None/null
    to prevent Starlette/FastAPI ASGI serialization crashes.
    """
    if isinstance(obj, dict):
        return {k: sanitize_float_values(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_float_values(x) for x in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    elif isinstance(obj, np.ndarray):
        return sanitize_float_values(obj.tolist())
    elif isinstance(obj, (np.float32, np.float64)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    elif isinstance(obj, (np.int32, np.int64)):
        return int(obj)
    return obj

# Include domain routers
app.include_router(datasets.router)
app.include_router(diagnostics.router)
app.include_router(validation.router)
app.include_router(preprocessing.router)
app.include_router(forecast.router)

logger.info("FastAPI service routers mapped and active.")
