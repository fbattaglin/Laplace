import pandas as pd
import numpy as np
from typing import Dict, List
import torch
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive, AutoARIMA
from model_registry import registry

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

def run_backtest(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str, 
    h: int = 12, 
    selected_models: List[str] = None, 
    covariate_cols: List[str] = None,
    cleaning_config: List[dict] = None,
    excluded_anomalies: List[int] = None
):
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)
    
    # Apply preprocessing pipeline
    from data_cleaning import preprocess_dataframe_for_modeling
    df_clean, variance_params = preprocess_dataframe_for_modeling(df, date_col, target_col, cleaning_config, excluded_anomalies)
    
    y = df_clean[target_col].astype(float).values
    dates = df_clean[date_col].astype(str).values
    n = len(y)
    
    if n <= h * 2:
        h = max(1, n // 5)
        
    y_train = y[:-h]
    y_test = y[-h:]
    test_dates = dates[-h:]
    
    # Store original values for metrics & payload (original scale)
    y_train_original = y_train.copy()
    y_test_original = y_test.copy()
    
    has_variance_transform = (variance_params and variance_params.get("method") != "none")
    if has_variance_transform:
        from data_cleaning import inverse_variance_transform
        y_train_original = inverse_variance_transform(y_train, variance_params)
        y_test_original = inverse_variance_transform(y_test, variance_params)
    
    period = 12
    inferred_freq = pd.infer_freq(df_clean[date_col])
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
    predictions_payload = {"dates": test_dates.tolist(), "actual": y_test_original.tolist()}
    metrics = []

    def log_result(name, preds):
        # Invert variance transform back to original scale if needed
        preds_original = preds.copy()
        if has_variance_transform:
            from data_cleaning import inverse_variance_transform
            preds_original = inverse_variance_transform(preds, variance_params)
            
        predictions_payload[name] = preds_original.tolist()
        m_smape = smape(y_test_original, preds_original)
        m_mase = mase(y_test_original, preds_original, y_train_original, period)
        m_rmse = rmse(y_test_original, preds_original)
        metrics.append({
            "model": name,
            "sMAPE": round(m_smape, 2),
            "MASE": round(m_mase, 3) if not np.isnan(m_mase) else 0,
            "RMSE": round(m_rmse, 2)
        })

    if selected_models is None:
        selected_models = ['SeasonalNaive', 'AutoETS', 'AutoTheta', 'AutoARIMA', 'Chronos-2', 'TimesFM-200M']

    # 1. StatsForecast Classical Models
    classical_models = []
    if 'SeasonalNaive' in selected_models: classical_models.append(SeasonalNaive(season_length=period))
    if 'AutoETS' in selected_models: classical_models.append(AutoETS(season_length=period))
    if 'AutoTheta' in selected_models: classical_models.append(AutoTheta(season_length=period))
    if 'AutoARIMA' in selected_models: classical_models.append(AutoARIMA(season_length=period))
    
    if classical_models:
        try:
            df_sf = pd.DataFrame({'unique_id': '1', 'ds': df_clean[date_col].iloc[:-h], 'y': y_train})
            sf = StatsForecast(models=classical_models, freq=freq_str, n_jobs=1)
            sf.fit(df_sf)
            sf_preds = sf.predict(h=h)
            
            for m in classical_models:
                m_name = m.__class__.__name__
                preds = sf_preds[m_name].values
                clean_name = m_name.replace('Auto', '')
                if m_name == 'AutoARIMA': clean_name = 'ARIMA'
                log_result(clean_name, preds)
        except Exception as e:
            print(f"StatsForecast error: {e}")

    # 2. Chronos Foundation Models
    if 'Chronos-2' in selected_models:
        try:
            past_covariates = None
            if covariate_cols:
                try:
                    from covariates import align_covariates
                    cov_data = align_covariates(df_clean, h, covariate_cols)
                    if cov_data["past_covariates"] is not None:
                        past_covariates = cov_data["past_covariates"][:-h] # exclude test horizon
                except Exception as e:
                    print(f"Failed to align covariates: {e}")
                    
            mean_pred, _, _ = registry.predict_chronos2(y_train, h, past_covariates=past_covariates)
            log_result("Chronos-2", mean_pred)
        except Exception as e:
            print(f"Skipping Chronos-2 due to error: {e}")
            
    # 3. TimesFM
    if 'TimesFM-200M' in selected_models:
        try:
            mean_pred, _, _ = registry.predict_timesfm(y_train, h)
            log_result("TimesFM-200M", mean_pred)
        except Exception as e:
            print(f"Skipping TimesFM due to error: {e}")

    # ── Ensemble: weighted combination of top-N models ──────────────────
    try:
        from ensemble import build_ensemble_from_validation
        result = build_ensemble_from_validation(
            metrics, predictions_payload, y_test_original, y_train_original, period, top_n=3
        )
        if result is not None:
            ensemble_metrics, ensemble_preds = result
            metrics.append(ensemble_metrics)
            predictions_payload["Ensemble"] = ensemble_preds.tolist()
    except Exception as e:
        print(f"Ensemble build skipped: {e}")

    # Sort results
    metrics.sort(key=lambda x: x["sMAPE"])
    
    return {
        "horizon": h,
        "metrics": metrics,
        "predictions": predictions_payload,
        "history": {
            "dates": dates[:-h].tolist(),
            "actual": y_train_original.tolist()
        }
    }
