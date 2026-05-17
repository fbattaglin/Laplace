import pandas as pd
import numpy as np
from forecast import run_forecast

# Create dummy data
dates = pd.date_range('2023-01-01', periods=100)
y = np.sin(np.linspace(0, 10, 100)) + np.random.normal(0, 0.1, 100)
df = pd.DataFrame({'date': dates, 'value': y})

try:
    res = run_forecast(df, 'date', 'value', model_name='Chronos-T5-Small', h=12)
    print("Completed forecast.")
    print("Forecast mean:", res['forecast']['mean'])
except Exception as e:
    import traceback
    traceback.print_exc()
