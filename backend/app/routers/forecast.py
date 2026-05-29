import os
import pandas as pd
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import ForecastRequest
from app.services.forecast import run_forecast

logger = logging.getLogger("laplace.routers.forecast")
router = APIRouter(prefix="/api")

DATA_DIR = "data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")

@router.post("/forecast")
def generate_forecast(req: ForecastRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        logger.error(f"Forecast target dataset not found: {req.dataset_name}")
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        logger.info(f"Generating true future forecast using model: {req.model_name}, horizon: {req.horizon}")
        from app.main import sanitize_float_values
        return sanitize_float_values(run_forecast(
            df, 
            req.date_col, 
            req.target_col, 
            req.model_name, 
            req.horizon, 
            req.covariate_cols,
            req.cleaning_config,
            req.excluded_anomalies,
            req.ensemble_config
        ))
    except Exception as e:
        logger.error(f"Forecast generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
