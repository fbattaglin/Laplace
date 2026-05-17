import pandas as pd
import numpy as np
import yfinance as yf
import os

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

def fetch_yfinance_data(ticker, filename, start="2018-01-01", end="2024-01-01"):
    print(f"Fetching {ticker}...")
    df = yf.download(ticker, start=start, end=end)
    # yf.download returns multi-level columns in recent versions, let's flatten or just take Close
    if isinstance(df.columns, pd.MultiIndex):
        close_col = df['Close'][ticker]
    else:
        close_col = df['Close']
        
    df_clean = pd.DataFrame({
        'Date': df.index.strftime('%Y-%m-%d'),
        'Value': close_col.values
    })
    df_clean.dropna(inplace=True)
    df_clean.to_csv(os.path.join(DATA_DIR, filename), index=False)
    print(f"Saved {filename}")

def generate_walmart_demand():
    print("Generating Walmart M5 Synthetic Demand...")
    dates = pd.date_range(start="2018-01-01", end="2023-12-31", freq='D')
    n = len(dates)
    
    # Base demand
    demand = 500 + 10 * np.sin(np.linspace(0, 20, n)) # slow trend
    
    # Weekly seasonality (higher on weekends)
    weekly_mult = np.where(dates.dayofweek >= 5, 1.3, 1.0)
    demand *= weekly_mult
    
    # Yearly seasonality (higher in November/December)
    yearly_mult = 1.0 + 0.4 * np.exp(-((dates.month - 12)**2) / 2) + 0.2 * np.exp(-((dates.month - 11)**2) / 1)
    demand *= yearly_mult
    
    # Noise
    demand += np.random.normal(0, 50, n)
    demand = np.maximum(demand, 0) # No negative demand
    
    df = pd.DataFrame({
        'Date': dates.strftime('%Y-%m-%d'),
        'Sales': np.round(demand)
    })
    df.to_csv(os.path.join(DATA_DIR, "walmart_m5.csv"), index=False)
    print("Saved walmart_m5.csv")

def generate_national_grid():
    print("Generating National Grid Energy Demand...")
    dates = pd.date_range(start="2018-01-01", end="2023-12-31", freq='D')
    n = len(dates)
    
    # Base load
    load = 25000 + 2000 * np.sin(np.linspace(0, 15, n))
    
    # Yearly seasonality (higher in winter and summer)
    # Peak in Jan/Feb and Jul/Aug
    winter_peak = 5000 * np.cos(2 * np.pi * (dates.dayofyear - 15) / 365)
    summer_peak = 3000 * np.exp(-((dates.month - 7)**2) / 2)
    load += winter_peak + summer_peak
    
    # Weekly effect (lower on weekends)
    weekly_mult = np.where(dates.dayofweek >= 5, 0.85, 1.0)
    load *= weekly_mult
    
    # Noise
    load += np.random.normal(0, 800, n)
    
    df = pd.DataFrame({
        'Date': dates.strftime('%Y-%m-%d'),
        'Load_MW': np.round(load)
    })
    df.to_csv(os.path.join(DATA_DIR, "national_grid.csv"), index=False)
    print("Saved national_grid.csv")

if __name__ == "__main__":
    fetch_yfinance_data("^GSPC", "sp500.csv")
    fetch_yfinance_data("^VIX", "vix.csv")
    generate_walmart_demand()
    generate_national_grid()
