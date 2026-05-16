import pandas as pd
import numpy as np
import torch
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive
import os

# Chronos configuration
CHRONOS_MODEL_ID = "amazon/chronos-bolt-small"
device = "mps" if torch.backends.mps.is_available() else "cpu"

def generate_future_dates(last_date: pd.Timestamp, freq_str: str, h: int) -> pd.DatetimeIndex:
    # A simple helper to generate future dates since we don't strictly have a constant freq
    try:
        return pd.date_range(start=last_date, periods=h+1, freq=freq_str)[1:]
    except:
        # Fallback to daily if frequency is weird or None
        return pd.date_range(start=last_date, periods=h+1, freq='D')[1:]

def run_forecast(df: pd.DataFrame, date_col: str, target_col: str, model_name: str, h: int = 12):
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)
    
    y = df[target_col].astype(float).interpolate(method='linear').bfill().ffill().values
    dates = df[date_col].values
    n = len(y)
    
    inferred_freq = pd.infer_freq(df[date_col])
    freq_str = inferred_freq if inferred_freq else 'D'
    
    period = 12
    if inferred_freq:
        f_lower = str(inferred_freq).lower()
        if 'd' in f_lower: period = 7
        elif 'h' in f_lower: period = 24
        elif 'q' in f_lower: period = 4
        elif 'm' in f_lower: period = 12
    elif n > 14 and n < 100: period = 7
    
    future_dates_dt = generate_future_dates(dates[-1], freq_str, h)
    future_dates = future_dates_dt.astype(str).tolist()
    
    mean_pred = []
    lower_pred = []
    upper_pred = []
    
    if model_name.startswith("Chronos"):
        try:
            from chronos import ChronosPipeline
            pipeline = ChronosPipeline.from_pretrained(CHRONOS_MODEL_ID, device_map=device, torch_dtype=torch.float32)
            context_tensor = torch.tensor(y)
            forecast_chronos = pipeline.predict(context_tensor, prediction_length=h)
            
            samples = forecast_chronos[0].numpy()
            mean_pred = np.quantile(samples, 0.5, axis=0).tolist()
            lower_pred = np.quantile(samples, 0.1, axis=0).tolist()
            upper_pred = np.quantile(samples, 0.9, axis=0).tolist()
        except Exception as e:
            print(f"Chronos error: {e}")
            raise ValueError(f"Chronos generation failed: {e}")
    else:
        # Classical models
        model_map = {
            'SeasonalNaive': SeasonalNaive(season_length=period),
            'ETS': AutoETS(season_length=period),
            'Theta': AutoTheta(season_length=period)
        }
        
        # Select the requested model or default to ETS
        sf_model = model_map.get(model_name, AutoETS(season_length=period))
        
        df_train = pd.DataFrame({
            'unique_id': '1',
            'ds': df[date_col],
            'y': y
        })
        
        sf = StatsForecast(models=[sf_model], freq=freq_str, n_jobs=1)
        sf.fit(df_train)
        
        # Predict with 80% confidence interval (10th to 90th percentile)
        forecasts = sf.predict(h=h, level=[80])
        
        col_prefix = model_name
        if model_name not in forecasts.columns:
            # StatsForecast output columns are usually the class name
            if model_name == 'ETS': col_prefix = 'AutoETS'
            elif model_name == 'Theta': col_prefix = 'AutoTheta'
        
        mean_pred = forecasts[col_prefix].values.tolist()
        lower_pred = forecasts[f'{col_prefix}-lo-80'].values.tolist()
        upper_pred = forecasts[f'{col_prefix}-hi-80'].values.tolist()

    # Log to CSV
    log_data = []
    for i in range(h):
        log_data.append({
            "Date": future_dates[i],
            "Forecast": mean_pred[i],
            "Lower_80": lower_pred[i],
            "Upper_80": upper_pred[i],
            "Model": model_name
        })
    log_df = pd.DataFrame(log_data)
    log_file = "data/results_log.csv"
    os.makedirs("data", exist_ok=True)
    mode = 'a' if os.path.exists(log_file) else 'w'
    header = not os.path.exists(log_file)
    log_df.to_csv(log_file, mode=mode, header=header, index=False)
    
    return {
        "model": model_name,
        "horizon": h,
        "history": {
            "dates": df[date_col].astype(str).tolist(),
            "actual": y.tolist()
        },
        "forecast": {
            "dates": future_dates,
            "mean": mean_pred,
            "lower": lower_pred,
            "upper": upper_pred
        }
    }
