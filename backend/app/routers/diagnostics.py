import os
import pandas as pd
import logging
from fastapi import APIRouter, HTTPException
from app.models.schemas import DiagnosticsRequest
from app.services.diagnostics import compute_diagnostics

logger = logging.getLogger("laplace.routers.diagnostics")
router = APIRouter(prefix="/api")

DATA_DIR = "data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")

@router.post("/diagnostics")
def run_diagnostics(req: DiagnosticsRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        logger.error(f"Diagnostics target dataset not found: {req.dataset_name}")
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        logger.info(f"Computing diagnostics for: {req.dataset_name}, date_col: {req.date_col}, target_col: {req.target_col}")
        from app.main import sanitize_float_values
        return sanitize_float_values(compute_diagnostics(df, req.date_col, req.target_col))
    except Exception as e:
        logger.error(f"Diagnostics execution failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
