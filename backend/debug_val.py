import pandas as pd
import numpy as np
from validation import run_backtest

# Create dummy data
dates = pd.date_range('2023-01-01', periods=100)
y = np.sin(np.linspace(0, 10, 100)) + np.random.normal(0, 0.1, 100)
df = pd.DataFrame({'date': dates, 'value': y})

res = run_backtest(df, 'date', 'value', h=12, selected_models=['Chronos-T5-Small', 'TimesFM-200M'])
print("Completed backtest.")
print("Models returned:", [m['model'] for m in res['metrics']])
