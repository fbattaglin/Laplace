import os
import pandas as pd
from typing import List
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
    problem_statement: str = ""

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "Laplace"}

@app.get("/api/datasets", response_model=List[DatasetInfo])
def list_datasets():
    return [
        {
            "name": "air_passengers", 
            "description": "Monthly airline passengers (1949-1960)",
            "problem_statement": "Predict monthly ticket sales to optimize fleet capacity."
        },
        {
            "name": "sp500", 
            "description": "S&P 500 Daily Closing Price (2018-2023)",
            "problem_statement": "Economics: High-variance random walk. Predict macro market direction."
        },
        {
            "name": "vix", 
            "description": "CBOE Volatility Index (2018-2023)",
            "problem_statement": "Economics: Mean-reverting volatility. Forecast periods of market fear."
        },
        {
            "name": "walmart_m5", 
            "description": "Walmart M5 Daily Demand (Synthetic)",
            "problem_statement": "Demand: Intermittent spikes and heavy holiday seasonality. Optimize inventory."
        },
        {
            "name": "national_grid", 
            "description": "National Grid Energy Load MW (Synthetic)",
            "problem_statement": "Supply: Dual-seasonality (weekly & yearly). Prevent power grid overload."
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
            
        return run_backtest(df, req.date_col, req.target_col, req.horizon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class ForecastRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    model_name: str
    horizon: int = 12

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
            
        return run_forecast(df, req.date_col, req.target_col, req.model_name, req.horizon)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



