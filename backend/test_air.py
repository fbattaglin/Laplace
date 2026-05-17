import pandas as pd
from forecast import run_forecast
try:
    df = pd.read_csv('data/air_passengers.csv')
    res = run_forecast(df, 'Month', 'Passengers', 'Chronos-T5-Small', 12)
    print("Success")
except Exception as e:
    print("ERROR:", e)
