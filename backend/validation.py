import pandas as pd
import numpy as np
from typing import Dict, List
import torch
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive

def smape(y_true, y_pred):
    return np.mean(2.0 * np.abs(y_pred - y_true) / (np.abs(y_pred) + np.abs(y_true) + 1e-8)) * 100

def mase(y_true, y_pred, y_train, period):
    if len(y_train) <= period:
        return np.nan
    naive_err = np.mean(np.abs(y_train[period:] - y_train[:-period]))
    if naive_err == 0:
        return np.nan
    return np.mean(np.abs(y_pred - y_true)) / naive_err

def rmse(y_true, y_pred):
    return np.sqrt(np.mean((y_true - y_pred)**2))

def run_backtest(df: pd.DataFrame, date_col: str, target_col: str, h: int = 12):
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)
    
    y = df[target_col].astype(float).interpolate(method='linear').bfill().ffill().values
    dates = df[date_col].astype(str).values
    n = len(y)
    
    if n <= h * 2:
        h = max(1, n // 5)
        
    y_train = y[:-h]
    y_test = y[-h:]
    test_dates = dates[-h:]
    
    period = 12
    inferred_freq = pd.infer_freq(df[date_col])
    freq_str = 'D'
    if inferred_freq:
        freq_str = str(inferred_freq)
        f_lower = freq_str.lower()
        if 'd' in f_lower: period = 7
        elif 'h' in f_lower: period = 24
        elif 'q' in f_lower: period = 4
        elif 'm' in f_lower: period = 12
    elif n > 14 and n < 100: period = 7
    
    model_results = []
    predictions_payload = {"dates": test_dates.tolist(), "actual": y_test.tolist()}
    metrics = []

    def log_result(name, preds):
        predictions_payload[name] = preds.tolist()
        m_smape = smape(y_test, preds)
        m_mase = mase(y_test, preds, y_train, period)
        m_rmse = rmse(y_test, preds)
        metrics.append({
            "model": name,
            "sMAPE": round(m_smape, 2),
            "MASE": round(m_mase, 3) if not np.isnan(m_mase) else 0,
            "RMSE": round(m_rmse, 2)
        })

    # Run Classical Models via statsforecast
    df_sf = pd.DataFrame({'unique_id': '1', 'ds': df[date_col].iloc[:-h], 'y': y_train})
    sf = StatsForecast(models=[SeasonalNaive(season_length=period), AutoETS(season_length=period), AutoTheta(season_length=period)], freq=freq_str, n_jobs=1)
    sf.fit(df_sf)
    sf_preds = sf.predict(h=h)
    
    for model_name in ['SeasonalNaive', 'AutoETS', 'AutoTheta']:
        preds = sf_preds[model_name].values
        clean_name = model_name.replace('Auto', '')
        log_result(clean_name, preds)

    # Run Chronos Foundation Models
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    chronos_models = {
        "Chronos-Bolt-Small": "amazon/chronos-bolt-small",
        "Chronos-Bolt-Base": "amazon/chronos-bolt-base"
    }
    
    for c_name, repo_id in chronos_models.items():
        try:
            from chronos import ChronosPipeline
            pipeline = ChronosPipeline.from_pretrained(repo_id, device_map=device, torch_dtype=torch.float32)
            context_tensor = torch.tensor(y_train)
            forecast = pipeline.predict(context_tensor, prediction_length=h)
            samples = forecast[0].numpy()
            median_pred = np.quantile(samples, 0.5, axis=0)
            log_result(c_name, median_pred)
        except Exception as e:
            print(f"Skipping {c_name} due to error: {e}")
            
    # Run TimesFM
    try:
        import timesfm
        tfm = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                backend="cpu",
                per_core_batch_size=1,
                horizon_len=128,
                context_len=512,
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
            )
        )
        inputs = [y_train.tolist()]
        point_forecast, _ = tfm.forecast(inputs, freq=[0])
        tfm_preds = point_forecast[0][:h]
        log_result("TimesFM-200M", tfm_preds)
    except Exception as e:
        print(f"Skipping TimesFM due to error: {e}")

    # Sort results
    metrics.sort(key=lambda x: x["sMAPE"])
    
    return {
        "horizon": h,
        "metrics": metrics,
        "predictions": predictions_payload,
        "history": {
            "dates": dates[:-h].tolist(),
            "actual": y_train.tolist()
        }
    }
