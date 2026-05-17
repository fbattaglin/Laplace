import os
import pandas as pd
import numpy as np
import yfinance as yf

SAMPLE_DIR = "../sample_datasets"
os.makedirs(SAMPLE_DIR, exist_ok=True)

def generate_bitcoin_excel():
    print("Fetching Bitcoin data via yfinance...")
    try:
        df = yf.download("BTC-USD", start="2020-01-01", end="2024-01-01")
        if isinstance(df.columns, pd.MultiIndex):
            close_col = df['Close']["BTC-USD"]
        else:
            close_col = df['Close']
            
        df_clean = pd.DataFrame({
            'Date': df.index.strftime('%Y-%m-%d'),
            'Close': close_col.values
        })
        df_clean.dropna(inplace=True)
        # Add some random missing values to test robustness
        indices_to_drop = np.random.choice(df_clean.index, size=15, replace=False)
        df_clean.loc[indices_to_drop, 'Close'] = np.nan
        
        output_path = os.path.join(SAMPLE_DIR, "bitcoin_daily_prices.xlsx")
        df_clean.to_excel(output_path, index=False)
        print(f"Generated {output_path}")
    except Exception as e:
        print(f"Failed to generate Bitcoin Excel: {e}")

def generate_retail_csv():
    print("Generating Retail Sales data...")
    dates = pd.date_range(start="2019-01-01", end="2023-12-31", freq='D')
    n = len(dates)
    
    # Base sales
    sales = 200 + 0.05 * np.arange(n) # Slow linear trend
    
    # Weekly seasonality (higher on weekends)
    weekly_mult = np.where(dates.dayofweek >= 5, 1.5, 1.0)
    sales *= weekly_mult
    
    # Yearly seasonality (Black Friday / Christmas peaks)
    yearly_mult = 1.0 + 0.8 * np.exp(-((dates.month - 12)**2) / 1.5) + 0.4 * np.exp(-((dates.month - 11)**2) / 0.5)
    sales *= yearly_mult
    
    # Noise
    sales += np.random.normal(0, 30, n)
    sales = np.maximum(sales, 0) # No negative sales
    
    df = pd.DataFrame({
        'date': dates.strftime('%Y-%m-%d'),
        'sales_volume': np.round(sales)
    })
    
    output_path = os.path.join(SAMPLE_DIR, "retail_store_sales.csv")
    df.to_csv(output_path, index=False)
    print(f"Generated {output_path}")

if __name__ == "__main__":
    generate_bitcoin_excel()
    generate_retail_csv()
