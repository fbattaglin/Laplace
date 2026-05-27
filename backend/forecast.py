import pandas as pd
import numpy as np
import torch
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive, AutoARIMA, RandomWalkWithDrift, HistoricAverage
from model_registry import registry
import os

CHRONOS_MODELS = {
    "Chronos-2": "amazon/chronos-t5-small",
    "Chronos-Bolt-Small": "amazon/chronos-bolt-small"
}

def generate_future_dates(last_date: pd.Timestamp, freq_str: str, h: int) -> pd.DatetimeIndex:
    try:
        return pd.date_range(start=last_date, periods=h+1, freq=freq_str)[1:]
    except:
        return pd.date_range(start=last_date, periods=h+1, freq='D')[1:]

def _run_single_model(model_name: str, y: np.ndarray, h: int, period: int, freq_str: str, df: pd.DataFrame, date_col: str, covariate_cols: list = None):
    """Run a single model and return {"mean": array, "lower": array, "upper": array} or None."""
    if model_name in CHRONOS_MODELS:
        past_covariates = None
        if covariate_cols:
            try:
                from covariates import align_covariates
                cov_data = align_covariates(df, h, covariate_cols)
                if cov_data["past_covariates"] is not None:
                    # _run_single_model doesn't exclude test horizon if y is already y_train, 
                    # but wait, here y is the full array if not using holdout?
                    # Ah, in forecast.py, y is the full array so we pass all past_covariates
                    past_covariates = cov_data["past_covariates"]
            except Exception as e:
                print(f"Failed to align covariates: {e}")
                
        mean_p, lower_p, upper_p = registry.predict_chronos2(y, h, past_covariates=past_covariates)
        return {"mean": mean_p, "lower": lower_p, "upper": upper_p}
    elif model_name == "TimesFM-200M":
        mean_p, lower_p, upper_p = registry.predict_timesfm(y, h)
        return {"mean": mean_p, "lower": lower_p, "upper": upper_p}
    else:
        model_map = {
            'SeasonalNaive': SeasonalNaive(season_length=period),
            'ETS': AutoETS(season_length=period),
            'Theta': AutoTheta(season_length=period),
            'ARIMA': AutoARIMA(season_length=period),
            'Drift': RandomWalkWithDrift(),
            'HistoricAverage': HistoricAverage()
        }
        sf_model = model_map.get(model_name)
        if sf_model is None:
            return None
        df_train = pd.DataFrame({'unique_id': '1', 'ds': df[date_col], 'y': y})
        sf = StatsForecast(models=[sf_model], freq=freq_str, n_jobs=1)
        sf.fit(df_train)
        forecasts = sf.predict(h=h, level=[80])
        col_prefix = model_name
        if model_name not in forecasts.columns:
            if model_name == 'ETS': col_prefix = 'AutoETS'
            elif model_name == 'Theta': col_prefix = 'AutoTheta'
            elif model_name == 'ARIMA': col_prefix = 'AutoARIMA'
            elif model_name == 'Drift': col_prefix = 'RWD'
        return {
            "mean": forecasts[col_prefix].values,
            "lower": forecasts[f'{col_prefix}-lo-80'].values,
            "upper": forecasts[f'{col_prefix}-hi-80'].values,
        }

def run_forecast(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str, 
    model_name: str, 
    h: int = 12, 
    covariate_cols: list = None,
    cleaning_config: list = None,
    excluded_anomalies: list = None,
    ensemble_config: dict = None
):
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)
    
    # Apply preprocessing pipeline
    from data_cleaning import preprocess_dataframe_for_modeling
    df_clean, variance_params = preprocess_dataframe_for_modeling(df, date_col, target_col, cleaning_config, excluded_anomalies)
    
    y = df_clean[target_col].astype(float).values
    dates = df_clean[date_col].values
    n = len(y)
    
    has_variance_transform = (variance_params and variance_params.get("method") != "none")
    
    inferred_freq = pd.infer_freq(df_clean[date_col])
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
    
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    
    if model_name == "Ensemble":
        # Run component models and combine with saved weights
        from ensemble import build_ensemble_forecast
        
        component_models = ['ARIMA', 'ETS', 'Chronos-2']
        ensemble_weights = None
        
        if ensemble_config:
            strategy = ensemble_config.get("strategy", "inverse_smape")
            custom_weights = ensemble_config.get("custom_weights", None)
            if custom_weights:
                component_models = list(custom_weights.keys())
                total_w = sum(custom_weights.values())
                if total_w > 0:
                    ensemble_weights = {k: v / total_w for k, v in custom_weights.items()}
                else:
                    ensemble_weights = {k: 1.0 / len(custom_weights) for k in custom_weights}
                    
        try:
            model_forecasts = {}
            for comp_name in component_models:
                try:
                    comp_result = _run_single_model(comp_name, y, h, period, freq_str, df_clean, date_col, covariate_cols)
                    if comp_result is not None:
                        model_forecasts[comp_name] = comp_result
                except Exception as e:
                    print(f"Ensemble component {comp_name} failed: {e}")
            
            if not model_forecasts:
                raise ValueError("No component models produced forecasts for ensemble")
            
            if ensemble_weights is None:
                n_models = len(model_forecasts)
                ensemble_weights = {name: 1.0 / n_models for name in model_forecasts}
            
            mean_arr, lower_arr, upper_arr = build_ensemble_forecast(
                model_forecasts, ensemble_weights, h
            )
            mean_pred = mean_arr.tolist()
            lower_pred = lower_arr.tolist()
            upper_pred = upper_arr.tolist()
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"Ensemble forecast error: {tb}")
            raise ValueError(f"Ensemble forecast failed: {e}")
            
    elif model_name in CHRONOS_MODELS:
        try:
            past_covariates = None
            if covariate_cols:
                try:
                    from covariates import align_covariates
                    cov_data = align_covariates(df_clean, h, covariate_cols)
                    if cov_data["past_covariates"] is not None:
                        past_covariates = cov_data["past_covariates"]
                except Exception as e:
                    print(f"Failed to align covariates: {e}")
                    
            mean_pred, lower_pred, upper_pred = registry.predict_chronos2(y, h, past_covariates=past_covariates)
            mean_pred = mean_pred.tolist()
            lower_pred = lower_pred.tolist()
            upper_pred = upper_pred.tolist()
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"Chronos error: {tb}")
            raise ValueError(f"Chronos generation failed: {e}\n{tb}")
            
    elif model_name == "TimesFM-200M":
        try:
            mean_pred, lower_pred, upper_pred = registry.predict_timesfm(y, h)
            mean_pred = mean_pred.tolist()
            lower_pred = lower_pred.tolist()
            upper_pred = upper_pred.tolist()
            
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            print(f"TimesFM error: {tb}")
            raise ValueError(f"TimesFM generation failed: {e}\n{tb}")
            
    else:
        # Classical models
        model_map = {
            'SeasonalNaive': SeasonalNaive(season_length=period),
            'ETS': AutoETS(season_length=period),
            'Theta': AutoTheta(season_length=period),
            'ARIMA': AutoARIMA(season_length=period)
        }
        
        sf_model = model_map.get(model_name, AutoETS(season_length=period))
        
        df_train = pd.DataFrame({
            'unique_id': '1',
            'ds': df_clean[date_col],
            'y': y
        })
        
        sf = StatsForecast(models=[sf_model], freq=freq_str, n_jobs=1)
        sf.fit(df_train)
        forecasts = sf.predict(h=h, level=[80])
        
        col_prefix = model_name
        if model_name not in forecasts.columns:
            if model_name == 'ETS': col_prefix = 'AutoETS'
            elif model_name == 'Theta': col_prefix = 'AutoTheta'
            elif model_name == 'ARIMA': col_prefix = 'AutoARIMA'
        
        mean_pred = forecasts[col_prefix].values.tolist()
        lower_pred = forecasts[f'{col_prefix}-lo-80'].values.tolist()
        upper_pred = forecasts[f'{col_prefix}-hi-80'].values.tolist()

    # Invert variance transform back to original scale if needed
    y_original = y.copy()
    mean_original = np.array(mean_pred)
    lower_original = np.array(lower_pred)
    upper_original = np.array(upper_pred)
    
    if has_variance_transform:
        from data_cleaning import inverse_variance_transform
        y_original = inverse_variance_transform(y, variance_params)
        mean_original = inverse_variance_transform(mean_original, variance_params)
        lower_original = inverse_variance_transform(lower_original, variance_params)
        upper_original = inverse_variance_transform(upper_original, variance_params)
        
    mean_pred = mean_original.tolist()
    lower_pred = lower_original.tolist()
    upper_pred = upper_original.tolist()
    y_tolist = y_original.tolist()

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
            "dates": df_clean[date_col].astype(str).tolist(),
            "actual": y_tolist
        },
        "forecast": {
            "dates": future_dates,
            "mean": mean_pred,
            "lower": lower_pred,
            "upper": upper_pred
        }
    }
