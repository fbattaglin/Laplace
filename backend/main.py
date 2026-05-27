import os
import pandas as pd
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from heuristics import process_dataframe

app = FastAPI(title="Laplace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_DIR = "data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DatasetInfo(BaseModel):
    name: str
    description: str
    problem_statement: str
    tags: List[str]
    has_covariates: Optional[bool] = False

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Laplace"}

@app.get("/api/datasets", response_model=List[DatasetInfo])
def list_datasets():
    return [
        {
            "name": "air_passengers", 
            "description": "Monthly airline passengers (1949-1960)",
            "problem_statement": "Predict monthly ticket sales to optimize fleet capacity.",
            "tags": ["Demand", "Seasonal", "Trend"],
            "has_covariates": False
        },
        {
            "name": "marketing_roi", 
            "description": "Daily Sales with Ad Spend Covariate (Synthetic)",
            "problem_statement": "Marketing: Forecast daily sales factoring in advertising spend and weekend seasonality.",
            "tags": ["Marketing", "Daily", "Covariates"],
            "has_covariates": True
        },
        {
            "name": "supply_chain_inventory", 
            "description": "Weekly Inventory Levels (Synthetic)",
            "problem_statement": "Supply Chain: Forecast inventory requirements driven by seasonal demand and supplier lead times.",
            "tags": ["Supply Chain", "Weekly", "Covariates"],
            "has_covariates": True
        },
        {
            "name": "saas_mrr", 
            "description": "Monthly SaaS MRR & Churn (Synthetic)",
            "problem_statement": "Economics: Project Monthly Recurring Revenue factoring in new customer acquisition and churn rates.",
            "tags": ["SaaS", "Monthly", "Covariates"],
            "has_covariates": True
        },
        {
            "name": "ev_charging_demand", 
            "description": "Hourly EV Charging Station kW (Synthetic)",
            "problem_statement": "Energy: Predict hourly electricity demand using temperature as an exogenous variable.",
            "tags": ["Energy", "Hourly", "Covariates"],
            "has_covariates": True
        },
        {
            "name": "agriculture_yield", 
            "description": "Yearly Crop Yield vs Rainfall (Synthetic)",
            "problem_statement": "Agriculture: Forecast crop yields based on rainfall amounts and fertilizer application.",
            "tags": ["Agriculture", "Yearly", "Covariates"],
            "has_covariates": True
        },
        {
            "name": "sp500", 
            "description": "S&P 500 Daily Closing Price (2018-2023)",
            "problem_statement": "Economics: High-variance random walk. Predict macro market direction.",
            "tags": ["Economics", "High-Noise", "Random-Walk"],
            "has_covariates": False
        },
        {
            "name": "vix", 
            "description": "CBOE Volatility Index (2018-2023)",
            "problem_statement": "Economics: Mean-reverting volatility. Forecast periods of market fear.",
            "tags": ["Economics", "Mean-Reverting", "High-Noise"],
            "has_covariates": False
        },
        {
            "name": "walmart_m5", 
            "description": "Walmart M5 Daily Demand (Synthetic)",
            "problem_statement": "Demand: Intermittent spikes and heavy holiday seasonality. Optimize inventory.",
            "tags": ["Retail", "Intermittent", "Seasonal"],
            "has_covariates": False
        },
        {
            "name": "national_grid", 
            "description": "National Grid Energy Load MW (Synthetic)",
            "problem_statement": "Supply: Dual-seasonality (weekly & yearly). Prevent power grid overload.",
            "tags": ["Energy", "Dual-Seasonality", "Stable"]
        }
    ]

@app.get("/api/datasets/{name}")
def get_dataset(name: str):
    file_path = os.path.join(DATA_DIR, f"{name}.csv")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        df = pd.read_csv(file_path)
        return process_dataframe(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_dataset(file: UploadFile = File(...)):
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="Only CSV or Excel files are supported")
    
    file_location = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_location, "wb") as buffer:
        buffer.write(await file.read())
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_location)
        else:
            df = pd.read_excel(file_location)
        return process_dataframe(df)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")

class DiagnosticsRequest(BaseModel):
    dataset_type: str # "reference" or "upload"
    dataset_name: str
    date_col: str
    target_col: str

from diagnostics import compute_diagnostics

@app.post("/api/diagnostics")
def run_diagnostics(req: DiagnosticsRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        return compute_diagnostics(df, req.date_col, req.target_col)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ValidationRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    horizon: int = 12
    selected_models: List[str] = None
    covariate_cols: List[str] = None
    cleaning_config: Optional[List[Dict[str, Any]]] = None
    excluded_anomalies: Optional[List[int]] = None

from validation import run_backtest

@app.post("/api/validation")
def run_validation(req: ValidationRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        return run_backtest(
            df, 
            req.date_col, 
            req.target_col, 
            req.horizon, 
            req.selected_models, 
            req.covariate_cols,
            req.cleaning_config,
            req.excluded_anomalies
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class CleanRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    config: List[Dict[str, Any]]

@app.post("/api/clean")
def clean_data(req: CleanRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        from data_cleaning import run_cleaning_pipeline
        return run_cleaning_pipeline(df, req.date_col, req.target_col, req.config)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class AnomalyRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    method: str = "isolation_forest"
    threshold: float = 0.05

@app.post("/api/anomalies/detect")
def detect_anomalies(req: AnomalyRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        from anomaly import run_anomaly_detection
        return run_anomaly_detection(df, req.date_col, req.target_col, req.method, req.threshold)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ForecastRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    model_name: str
    horizon: int = 12
    covariate_cols: List[str] = None
    cleaning_config: Optional[List[Dict[str, Any]]] = None
    excluded_anomalies: Optional[List[int]] = None

from forecast import run_forecast

@app.post("/api/forecast")
def generate_forecast(req: ForecastRequest):
    if req.dataset_type == "reference":
        file_path = os.path.join(DATA_DIR, f"{req.dataset_name}.csv")
    else:
        file_path = os.path.join(UPLOAD_DIR, req.dataset_name)
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Dataset not found")
        
    try:
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
            
        return run_forecast(
            df, 
            req.date_col, 
            req.target_col, 
            req.model_name, 
            req.horizon, 
            req.covariate_cols,
            req.cleaning_config,
            req.excluded_anomalies
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



