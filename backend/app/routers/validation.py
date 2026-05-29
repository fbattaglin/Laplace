import os
import pandas as pd
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import ValidationRequest
from app.services.validation import run_backtest

logger = logging.getLogger("laplace.routers.validation")
router = APIRouter(prefix="/api")

DATA_DIR = "data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")

@router.post("/validation")
def run_validation(req: ValidationRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        logger.error(f"Validation target dataset not found: {req.dataset_name}")
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        logger.info(f"Triggering backtest validation. Type: {req.validation_type}, splits: {req.num_splits}, models: {req.selected_models}")
        from app.main import sanitize_float_values
        return sanitize_float_values(run_backtest(
            df, 
            req.date_col, 
            req.target_col, 
            req.horizon, 
            req.selected_models, 
            req.covariate_cols,
            req.cleaning_config,
            req.excluded_anomalies,
            req.validation_type,
            req.num_splits,
            req.ensemble_config
        ))
    except Exception as e:
        logger.error(f"Backtest validation execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
