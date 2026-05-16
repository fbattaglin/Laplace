import pandas as pd
import os

DATA_DIR = "data"
os.makedirs(DATA_DIR, exist_ok=True)

print("Downloading AirPassengers...")
url_ap = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/airline-passengers.csv"
try:
    df_ap = pd.read_csv(url_ap)
    df_ap.to_csv(os.path.join(DATA_DIR, "air_passengers.csv"), index=False)
    print("AirPassengers saved.")
except Exception as e:
    print("Error:", e)

print("Downloading Daily Minimum Temperatures (Proxy for M4/ETTh1 sample)...")
url_temp = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/daily-min-temperatures.csv"
try:
    df_temp = pd.read_csv(url_temp)
    df_temp.to_csv(os.path.join(DATA_DIR, "daily_temperatures.csv"), index=False)
    print("Daily Temperatures saved.")
except Exception as e:
    print("Error:", e)

print("Done.")
