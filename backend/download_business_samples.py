import os
import pandas as pd
import numpy as np
import yfinance as yf

# Target directory: sample_datasets at the root of the workspace
WORKSPACE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLE_DIR = os.path.join(WORKSPACE_DIR, "sample_datasets")
os.makedirs(SAMPLE_DIR, exist_ok=True)

print(f"Target directory for new sample datasets: {SAMPLE_DIR}")

def download_retail_sales():
    print("\n[1/5] Fetching US Retail Sales (FRED: RSXFS) ...")
    try:
        url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=RSXFS"
        df = pd.read_csv(url)
        df.columns = ["Date", "Sales_Millions"]
        # Remove any rows with "." (missing values in FRED)
        df = df[df["Sales_Millions"] != "."]
        df["Sales_Millions"] = df["Sales_Millions"].astype(float)
        # Filter from 2005 onwards for a clean modern series
        df["Date"] = pd.to_datetime(df["Date"])
        df = df[df["Date"] >= "2005-01-01"]
        df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
        
        out_path = os.path.join(SAMPLE_DIR, "us_retail_sales.csv")
        df.to_csv(out_path, index=False)
        print(f"  ✓ Saved to: {out_path} ({len(df)} rows)")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

def download_inflation_cpi():
    print("\n[2/5] Fetching US Inflation CPI (FRED: CPIAUCSL) ...")
    try:
        url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=CPIAUCSL"
        df = pd.read_csv(url)
        df.columns = ["Date", "CPI"]
        df = df[df["CPI"] != "."]
        df["CPI"] = df["CPI"].astype(float)
        df["Date"] = pd.to_datetime(df["Date"])
        df = df[df["Date"] >= "2000-01-01"]
        df["Date"] = df["Date"].dt.strftime("%Y-%m-%d")
        
        out_path = os.path.join(SAMPLE_DIR, "us_inflation_cpi.csv")
        df.to_csv(out_path, index=False)
        print(f"  ✓ Saved to: {out_path} ({len(df)} rows)")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

def download_crude_oil():
    print("\n[3/5] Fetching Crude Oil daily closing prices (yfinance: CL=F) ...")
    try:
        # Fetch Crude oil daily futures
        df = yf.download("CL=F", start="2018-01-01", end="2024-01-01")
        if isinstance(df.columns, pd.MultiIndex):
            close_col = df['Close']["CL=F"]
        else:
            close_col = df['Close']
            
        df_clean = pd.DataFrame({
            'Date': df.index.strftime('%Y-%m-%d'),
            'Price_USD': close_col.values
        })
        df_clean.dropna(inplace=True)
        
        out_path = os.path.join(SAMPLE_DIR, "crude_oil_prices.xlsx")
        df_clean.to_excel(out_path, index=False)
        print(f"  ✓ Saved to: {out_path} ({len(df_clean)} rows, Excel format)")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

def download_website_traffic():
    print("\n[4/5] Fetching Wikipedia Web Traffic (Prophet: Peyton Manning) ...")
    try:
        url = "https://raw.githubusercontent.com/facebook/prophet/main/examples/example_wp_log_peyton_manning.csv"
        df = pd.read_csv(url)
        df.columns = ["Date", "Log_Views"]
        # Convert log scale back to actual views count
        df["Page_Views"] = np.round(np.exp(df["Log_Views"])).astype(int)
        df = df.drop(columns=["Log_Views"])
        
        out_path = os.path.join(SAMPLE_DIR, "website_traffic.csv")
        df.to_csv(out_path, index=False)
        print(f"  ✓ Saved to: {out_path} ({len(df)} rows)")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

def download_pharma_sales():
    print("\n[5/5] Fetching Monthly Pharma Drug Sales (Selva: a10) ...")
    try:
        url = "https://raw.githubusercontent.com/selva86/datasets/master/a10.csv"
        df = pd.read_csv(url)
        df.columns = ["Date", "Sales_AUD_Millions"]
        df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")
        
        out_path = os.path.join(SAMPLE_DIR, "pharma_drug_sales.csv")
        df.to_csv(out_path, index=False)
        print(f"  ✓ Saved to: {out_path} ({len(df)} rows)")
    except Exception as e:
        print(f"  ✗ Failed: {e}")

if __name__ == "__main__":
    download_retail_sales()
    download_inflation_cpi()
    download_crude_oil()
    download_website_traffic()
    download_pharma_sales()
    print("\nAll 5 new interesting business datasets populated successfully in sample_datasets!")
