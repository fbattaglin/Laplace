import os
import pandas as pd
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import DatasetInfo
from app.services.heuristics import process_dataframe

logger = logging.getLogger("laplace.routers.datasets")
router = APIRouter(prefix="/api")

DATA_DIR = "data"
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.get("/health")
def health_check():
    return {"status": "ok", "app": "Laplace"}

@router.get("/datasets", response_model=list[DatasetInfo])
def list_datasets():
    logger.info("Listing reference benchmark datasets.")
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
            "tags": ["Energy", "Dual-Seasonality", "Stable"],
            "has_covariates": False
        },
        {
            "name": "canadian_lynx", 
            "description": "Annual Canadian Lynx Trappings (1821-1934)",
            "problem_statement": "Classic: Forecast predator-prey population cycles driven by 10-year biological feedback loops.",
            "tags": ["Classic", "Yearly", "Cycles"],
            "has_covariates": False
        },
        {
            "name": "monthly_sunspots", 
            "description": "Monthly Mean Sunspot Numbers (1749-1983)",
            "problem_statement": "Classic: Forecast cyclical solar activity (11-year Schwabe cycles) to predict space weather dynamics.",
            "tags": ["Classic", "Monthly", "Cycles"],
            "has_covariates": False
        },
        {
            "name": "daily_temperatures", 
            "description": "Daily Minimum Temperatures in Melbourne (1981-1990)",
            "problem_statement": "Environment: Predict local daily temperature variations to optimize municipal heating and cooling systems.",
            "tags": ["Classic", "Daily", "Seasonality"],
            "has_covariates": True
        },
        {
            "name": "website_traffic", 
            "description": "Wikipedia Page Views for Peyton Manning (Prophet Example)",
            "problem_statement": "Marketing: Forecast daily web page traffic, featuring strong weekly seasonality and extreme event-driven spikes.",
            "tags": ["Classic", "Daily", "Prophet", "Anomalies"],
            "has_covariates": True
        },
        {
            "name": "pharma_drug_sales", 
            "description": "Monthly Pharmaceutical Drug Sales in Australia (1991-2008)",
            "problem_statement": "Demand: Forecast pharmaceutical drug sales featuring a strong upward trend and highly seasonal peaks.",
            "tags": ["Classic", "Monthly", "Trend", "Seasonal"],
            "has_covariates": False
        },
        {
            "name": "us_inflation_cpi", 
            "description": "US Consumer Price Index for All Urban Consumers (2000-2023)",
            "problem_statement": "Economics: Forecast macroeconomic inflation trends to project consumer buying power changes.",
            "tags": ["Economics", "Monthly", "FRED", "Trend"],
            "has_covariates": True
        },
        {
            "name": "us_retail_sales", 
            "description": "US Advance Retail Sales: Retail and Food Services (2005-2023)",
            "problem_statement": "Economics: Forecast aggregate consumer retail demand, including massive November/December holiday spikes.",
            "tags": ["Economics", "Monthly", "FRED", "Seasonal"],
            "has_covariates": True
        }
    ]

@router.get("/datasets/{name}")
def get_dataset(name: str):
    file_path = os.path.join(DATA_DIR, f"{name}.csv")
    if not os.path.exists(file_path):
        logger.error(f"Reference dataset not found: {name}")
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        df = pd.read_csv(file_path)
        from app.services.heuristics import detect_columns
        date_col, _ = detect_columns(df)
        if date_col:
            from app.services.covariates import add_calendar_features
            df = add_calendar_features(df, date_col)
            
        from app.main import sanitize_float_values
        return sanitize_float_values(process_dataframe(df))
    except Exception as e:
        logger.error(f"Failed to fetch dataset {name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
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
        
        from app.services.heuristics import detect_columns
        date_col, _ = detect_columns(df)
        if date_col:
            from app.services.covariates import add_calendar_features
            df = add_calendar_features(df, date_col)
            
        logger.info(f"Successfully uploaded and parsed: {file.filename}")
        from app.main import sanitize_float_values
        return sanitize_float_values(process_dataframe(df))
    except Exception as e:
        logger.error(f"Failed to process uploaded file {file.filename}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
