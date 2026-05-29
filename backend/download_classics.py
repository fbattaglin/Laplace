import os
import pandas as pd

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)

def download_canadian_lynx():
    print("Downloading Canadian Lynx dataset...")
    url = "https://vincentarelbundock.github.io/Rdatasets/csv/datasets/lynx.csv"
    try:
        df = pd.read_csv(url)
        # Columns are: rownames, time, value
        # time represents the year (1821-1934)
        # value is the number of trappings
        df_clean = pd.DataFrame({
            "Date": df["time"].astype(str) + "-12-31",
            "Value": df["value"].astype(float)
        })
        out_path = os.path.join(DATA_DIR, "canadian_lynx.csv")
        df_clean.to_csv(out_path, index=False)
        print(f"✓ Saved Canadian Lynx to: {out_path} ({len(df_clean)} rows)")
    except Exception as e:
        print(f"✗ Failed to download Canadian Lynx: {e}")

def download_monthly_sunspots():
    print("Downloading Monthly Sunspots dataset...")
    url = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/monthly-sunspots.csv"
    try:
        df = pd.read_csv(url)
        # Columns are: Month, Sunspots
        # Month format: YYYY-MM
        df_clean = pd.DataFrame({
            "Date": df["Month"].astype(str) + "-01",
            "Value": df["Sunspots"].astype(float)
        })
        out_path = os.path.join(DATA_DIR, "monthly_sunspots.csv")
        df_clean.to_csv(out_path, index=False)
        print(f"✓ Saved Monthly Sunspots to: {out_path} ({len(df_clean)} rows)")
    except Exception as e:
        print(f"✗ Failed to download Monthly Sunspots: {e}")

if __name__ == "__main__":
    download_canadian_lynx()
    download_monthly_sunspots()
