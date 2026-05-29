import time
import math
import logging
import pandas as pd
import numpy as np
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive, AutoARIMA, RandomWalkWithDrift, HistoricAverage

from app.core.model_registry import registry
from app.services.cleaning import preprocess_dataframe_for_modeling, inverse_variance_transform
from app.services.covariates import align_covariates
from app.services.changepoint_adaptation import adapt_training_data_for_shocks

logger = logging.getLogger("laplace.services.validation")

def smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(2.0 * np.abs(y_pred - y_true) / (np.abs(y_pred) + np.abs(y_true) + 1e-8)) * 100)

def mase(y_true: np.ndarray, y_pred: np.ndarray, y_train: np.ndarray, period: int) -> float:
    if len(y_train) <= period:
        return np.nan
    naive_err = np.mean(np.abs(y_train[period:] - y_train[:-period]))
    if naive_err == 0:
        return np.nan
    return float(np.mean(np.abs(y_pred - y_true)) / naive_err)

def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred)**2)))

def compute_diebold_mariano(actual: np.ndarray, pred1: np.ndarray, pred2: np.ndarray) -> float:
    """
    Computes a t-test based Diebold-Mariano p-value comparing absolute errors of pred1 vs pred2.
    """
    try:
        e1 = np.abs(actual - pred1)
        e2 = np.abs(actual - pred2)
        d = e2 - e1
        n = len(d)
        if n < 3:
            return 1.0
        
        mean_d = np.mean(d)
        var_d = np.var(d, ddof=1)
        if var_d == 0:
            return 1.0 if mean_d <= 0 else 0.0
            
        t_stat = mean_d / np.sqrt(var_d / n)
        
        def normal_cdf(x):
            return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0
            
        try:
            import scipy.stats as stats
            p_val = 2.0 * (1.0 - stats.t.cdf(np.abs(t_stat), df=n-1))
        except Exception:
            p_val = 2.0 * (1.0 - normal_cdf(abs(t_stat)))
            
        return float(np.clip(p_val, 0.0, 1.0))
    except Exception as e:
        logger.error(f"Diebold-Mariano calculation failed: {e}")
        return 1.0

MODEL_KEY_TO_CLEAN = {
    'AutoARIMA': 'ARIMA',
    'AutoETS': 'ETS',
    'AutoTheta': 'Theta',
    'SeasonalNaive': 'SeasonalNaive',
    'RandomWalkWithDrift': 'Drift',
    'HistoricAverage': 'HistoricAverage',
    'Chronos-2': 'Chronos-2',
    'TimesFM-200M': 'TimesFM-200M'
}

def run_backtest(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str, 
    h: int = 12, 
    selected_models: list[str] | None = None, 
    covariate_cols: list[str] | None = None,
    cleaning_config: list[dict] | None = None,
    excluded_anomalies: list[int] | None = None,
    validation_type: str = "holdout",
    num_splits: int = 3,
    ensemble_config: dict | None = None
) -> dict[str, any]:
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col)
    
    df_clean, variance_params = preprocess_dataframe_for_modeling(df, date_col, target_col, cleaning_config, excluded_anomalies)
    
    y = df_clean[target_col].astype(float).values
    dates = df_clean[date_col].astype(str).values
    n = len(y)
    
    if validation_type == "walk_forward":
        min_train_len = max(2 * h, 10)
        actual_splits = num_splits
        while actual_splits > 1 and n - (actual_splits * h) < min_train_len:
            actual_splits -= 1
        if actual_splits < 2:
            validation_type = "holdout"
            actual_splits = 1
    else:
        actual_splits = 1
        
    if n <= h * 2:
        h = max(1, n // 5)
        validation_type = "holdout"
        actual_splits = 1
        
    splits_data = []
    if validation_type == "walk_forward":
        for i in range(actual_splits):
            test_start = n - (actual_splits - i) * h
            test_end = test_start + h
            splits_data.append({
                "test_start": test_start,
                "test_end": test_end
            })
    else:
        splits_data = [{
            "test_start": n - h,
            "test_end": n
        }]
        
    if selected_models is None:
        selected_models = ['SeasonalNaive', 'AutoETS', 'AutoTheta', 'AutoARIMA', 'Chronos-2', 'TimesFM-200M']

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
    
    clean_model_names = [MODEL_KEY_TO_CLEAN.get(m, m) for m in selected_models]
    all_split_predictions = {name: [] for name in clean_model_names}
    execution_times = {name: 0.0 for name in clean_model_names}
    split_errors = {name: [] for name in clean_model_names}
    split_mases = {name: [] for name in clean_model_names}
    split_rmses = {name: [] for name in clean_model_names}
    all_split_actuals = []
    
    last_predictions = {}
    has_variance_transform = (variance_params and variance_params.get("method") != "none")

    for s_idx, split in enumerate(splits_data):
        t_start = split["test_start"]
        t_end = split["test_end"]
        
        y_tr = y[:t_start]
        y_te = y[t_start:t_end]
        
        # Apply Changepoint-Aware Adaptive Training on the training slice
        y_tr_fitted, df_tr_fitted, shock_idx = adapt_training_data_for_shocks(
            y_tr, df_clean.iloc[:t_start], period, date_col, target_col
        )
        
        y_tr_original = y_tr.copy()
        y_te_original = y_te.copy()
        if has_variance_transform:
            y_tr_original = inverse_variance_transform(y_tr, variance_params)
            y_te_original = inverse_variance_transform(y_te, variance_params)
            
        all_split_actuals.extend(y_te_original.tolist())
        
        classical_models = []
        if 'SeasonalNaive' in selected_models: classical_models.append(SeasonalNaive(season_length=period))
        if 'AutoETS' in selected_models: classical_models.append(AutoETS(season_length=period))
        if 'AutoTheta' in selected_models: classical_models.append(AutoTheta(season_length=period))
        if 'AutoARIMA' in selected_models: classical_models.append(AutoARIMA(season_length=period))
        if 'RandomWalkWithDrift' in selected_models: classical_models.append(RandomWalkWithDrift())
        if 'HistoricAverage' in selected_models: classical_models.append(HistoricAverage())
        
        if classical_models:
            t0 = time.time()
            try:
                df_sf = pd.DataFrame({'unique_id': '1', 'ds': df_tr_fitted[date_col], 'y': y_tr_fitted})
                sf = StatsForecast(models=classical_models, freq=freq_str, n_jobs=1)
                sf.fit(df_sf)
                sf_preds = sf.predict(h=h)
                
                dt = (time.time() - t0) / len(classical_models)
                
                for m in classical_models:
                    m_name = m.__class__.__name__
                    col_name = 'RWD' if m_name == 'RandomWalkWithDrift' else m_name
                    
                    preds = sf_preds[col_name].values
                    clean_name = MODEL_KEY_TO_CLEAN.get(m_name, m_name)
                    execution_times[clean_name] += dt
                    
                    preds_original = preds.copy()
                    if has_variance_transform:
                        preds_original = inverse_variance_transform(preds, variance_params)
                        
                    all_split_predictions[clean_name].extend(preds_original.tolist())
                    if s_idx == len(splits_data) - 1:
                        last_predictions[clean_name] = preds_original.tolist()
                        
                    split_errors[clean_name].append(smape(y_te_original, preds_original))
                    split_mases[clean_name].append(mase(y_te_original, preds_original, y_tr_original, period))
                    split_rmses[clean_name].append(rmse(y_te_original, preds_original))
            except Exception as e:
                logger.error(f"StatsForecast error in split {s_idx}: {e}")
                
        if 'Chronos-2' in selected_models:
            t0 = time.time()
            try:
                past_covariates = None
                if covariate_cols:
                    try:
                        cov_data = align_covariates(df_tr_fitted, h, covariate_cols)
                        if cov_data["past_covariates"] is not None:
                            past_covariates = cov_data["past_covariates"]
                    except Exception as e:
                        logger.error(f"Failed to align covariates: {e}")
                
                mean_pred, _, _ = registry.predict_chronos2(y_tr_fitted, h, past_covariates=past_covariates)
                dt = time.time() - t0
                execution_times['Chronos-2'] += dt
                
                preds_original = mean_pred.copy()
                if has_variance_transform:
                    preds_original = inverse_variance_transform(mean_pred, variance_params)
                    
                all_split_predictions['Chronos-2'].extend(preds_original.tolist())
                if s_idx == len(splits_data) - 1:
                    last_predictions['Chronos-2'] = preds_original.tolist()
                    
                split_errors['Chronos-2'].append(smape(y_te_original, preds_original))
                split_mases['Chronos-2'].append(mase(y_te_original, preds_original, y_tr_original, period))
                split_rmses['Chronos-2'].append(rmse(y_te_original, preds_original))
            except Exception as e:
                logger.error(f"Chronos generation failed in split {s_idx}: {e}")
 
        if 'TimesFM-200M' in selected_models:
            t0 = time.time()
            try:
                mean_pred, _, _ = registry.predict_timesfm(y_tr_fitted, h)
                dt = time.time() - t0
                execution_times['TimesFM-200M'] += dt
                
                preds_original = mean_pred.copy()
                if has_variance_transform:
                    preds_original = inverse_variance_transform(mean_pred, variance_params)
                    
                all_split_predictions['TimesFM-200M'].extend(preds_original.tolist())
                if s_idx == len(splits_data) - 1:
                    last_predictions['TimesFM-200M'] = preds_original.tolist()
                    
                split_errors['TimesFM-200M'].append(smape(y_te_original, preds_original))
                split_mases['TimesFM-200M'].append(mase(y_te_original, preds_original, y_tr_original, period))
                split_rmses['TimesFM-200M'].append(rmse(y_te_original, preds_original))
            except Exception as e:
                logger.error(f"TimesFM generation failed in split {s_idx}: {e}")

    # Ensemble Calculation
    if len(clean_model_names) >= 2:
        clean_model_names.append("Ensemble")
        all_split_predictions["Ensemble"] = []
        split_errors["Ensemble"] = []
        split_mases["Ensemble"] = []
        split_rmses["Ensemble"] = []
        execution_times["Ensemble"] = 0.02
        
        last_ensemble_weights = {}
        last_strategy = "inverse_smape"
        
        for s_idx in range(len(splits_data)):
            t_start = splits_data[s_idx]["test_start"]
            t_end = splits_data[s_idx]["test_end"]
            
            y_te = y[t_start:t_end]
            y_tr = y[:t_start]
            
            y_tr_original = y_tr.copy()
            y_te_original = y_te.copy()
            if has_variance_transform:
                y_tr_original = inverse_variance_transform(y_tr, variance_params)
                y_te_original = inverse_variance_transform(y_te, variance_params)
                
            split_metrics = []
            for name in clean_model_names:
                if name == "Ensemble": continue
                if s_idx < len(split_errors[name]):
                    split_metrics.append({
                        "model": name,
                        "sMAPE": split_errors[name][s_idx]
                    })
            
            strategy = "inverse_smape"
            custom_weights = None
            if ensemble_config:
                strategy = ensemble_config.get("strategy", "inverse_smape")
                custom_weights = ensemble_config.get("custom_weights", None)
                
            weights = {}
            if strategy == "custom" and custom_weights:
                valid_custom = {k: float(v) for k, v in custom_weights.items() if any(m["model"] == k for m in split_metrics)}
                if valid_custom:
                    total = sum(valid_custom.values())
                    weights = {k: v / total if total > 0 else 1.0/len(valid_custom) for k, v in valid_custom.items()}
                else:
                    strategy = "inverse_smape"
                    
            if strategy == "equal":
                sorted_metrics = sorted(split_metrics, key=lambda m: m["sMAPE"])
                top_models = [m["model"] for m in sorted_metrics[:3]]
                weights = {m: 1.0 / len(top_models) for m in top_models}
                
            if not weights or strategy == "inverse_smape":
                from app.services.ensemble import compute_ensemble_weights
                weights = compute_ensemble_weights(split_metrics, top_n=3)
                
            if s_idx == len(splits_data) - 1:
                last_ensemble_weights = weights
                last_strategy = strategy
                
            ensemble_preds = np.zeros(h)
            total_weight = 0.0
            for name, w in weights.items():
                model_split_preds = all_split_predictions[name][s_idx*h : (s_idx+1)*h]
                ensemble_preds += float(w) * np.array(model_split_preds)
                total_weight += float(w)
                
            if total_weight > 0 and total_weight < 0.99:
                ensemble_preds /= total_weight
                
            all_split_predictions["Ensemble"].extend(ensemble_preds.tolist())
            if s_idx == len(splits_data) - 1:
                last_predictions["Ensemble"] = ensemble_preds.tolist()
                
            split_errors["Ensemble"].append(smape(y_te_original, ensemble_preds))
            split_mases["Ensemble"].append(mase(y_te_original, ensemble_preds, y_tr_original, period))
            split_rmses["Ensemble"].append(rmse(y_te_original, ensemble_preds))

    metrics_summary = []
    for name in clean_model_names:
        errors = split_errors[name]
        rmses = split_rmses[name]
        mases = split_mases[name]
        
        if len(errors) > 0:
            avg_smape = np.mean(errors)
            std_smape = np.std(errors) if len(errors) > 1 else 0.0
            avg_rmse = np.mean(rmses)
            avg_mase = np.mean(mases)
            
            summary = {
                "model": name,
                "sMAPE": round(float(avg_smape), 2),
                "sMAPE_std": round(float(std_smape), 2),
                "MASE": round(float(avg_mase), 3) if not np.isnan(avg_mase) else 0.0,
                "RMSE": round(float(avg_rmse), 2),
                "latency": round(execution_times[name], 3)
            }
            
            if name == "Ensemble":
                summary["weights"] = {k: round(v, 3) for k, v in last_ensemble_weights.items()}
                summary["component_models"] = list(last_ensemble_weights.keys())
                summary["strategy"] = last_strategy
                
            metrics_summary.append(summary)
            
    metrics_summary.sort(key=lambda x: x["sMAPE"])

    dm_p_value = 1.0
    dm_comparison_model = "SeasonalNaive"
    if len(metrics_summary) > 1:
        winner_name = metrics_summary[0]["model"]
        if winner_name != dm_comparison_model and dm_comparison_model in all_split_predictions and winner_name in all_split_predictions:
            actual_all = np.array(all_split_actuals)
            pred_winner = np.array(all_split_predictions[winner_name])
            pred_baseline = np.array(all_split_predictions[dm_comparison_model])
            if len(actual_all) == len(pred_winner) == len(pred_baseline):
                dm_p_value = compute_diebold_mariano(actual_all, pred_winner, pred_baseline)

    last_actual_original = y[-h:]
    if has_variance_transform:
        last_actual_original = inverse_variance_transform(last_actual_original, variance_params)
        
    predictions_payload = {
        "dates": dates[-h:].tolist(),
        "actual": last_actual_original.tolist()
    }
    for name, preds in last_predictions.items():
        predictions_payload[name] = preds

    last_split_t_start = splits_data[-1]["test_start"]
    y_train_original = y[:last_split_t_start]
    if has_variance_transform:
        y_train_original = inverse_variance_transform(y_train_original, variance_params)

    logger.info(f"Backtest validation successful. Completed {len(splits_data)} splits using {validation_type}.")
    return {
        "horizon": h,
        "metrics": metrics_summary,
        "predictions": predictions_payload,
        "history": {
            "dates": dates[:last_split_t_start].tolist(),
            "actual": y_train_original.tolist()
        },
        "validation_type": validation_type,
        "actual_splits": len(splits_data),
        "dm_p_value": dm_p_value,
        "dm_comparison_model": dm_comparison_model
    }
