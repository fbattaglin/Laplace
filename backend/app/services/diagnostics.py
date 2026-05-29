import logging
import pandas as pd
import numpy as np
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import acf, pacf, adfuller
import ruptures as rpt
from scipy.stats import skew, kurtosis

from app.services.anomalies import detect_anomalies_isolation_forest
from app.services.covariates import analyze_covariates

logger = logging.getLogger("laplace.services.diagnostics")

def compute_diagnostics(df: pd.DataFrame, date_col: str, target_col: str) -> dict[str, any]:
    """
    Computes STL decomposition, ACF, PACF, Forecastability Score, Basic Stats, 
    Anomalies (Isolation Forest), and Changepoints (Ruptures).
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).set_index(date_col)
    
    y_raw = df[target_col].astype(float)
    
    stats = {
        "start_date": str(df.index.min().date()) if hasattr(df.index.min(), 'date') else str(df.index.min()),
        "end_date": str(df.index.max().date()) if hasattr(df.index.max(), 'date') else str(df.index.max()),
        "count": len(y_raw),
        "missing_pct": float(np.round((y_raw.isna().sum() / len(y_raw)) * 100, 2)),
        "zeros_pct": float(np.round(((y_raw == 0).sum() / len(y_raw)) * 100, 2)),
        "mean": float(np.round(y_raw.mean(), 2)),
        "std": float(np.round(y_raw.std(), 2)),
        "min": float(np.round(y_raw.min(), 2)),
        "max": float(np.round(y_raw.max(), 2)),
        "skewness": float(np.round(skew(y_raw.dropna()), 2)),
        "kurtosis": float(np.round(kurtosis(y_raw.dropna()), 2))
    }
    
    y = y_raw.interpolate(method='linear').bfill().ffill()
    n = len(y)
    
    inferred_freq = pd.infer_freq(df.index)
    period = 12 
    if inferred_freq:
        freq_str = str(inferred_freq).lower()
        if 'd' in freq_str: period = 7
        elif 'h' in freq_str: period = 24
        elif 'q' in freq_str: period = 4
        elif 'm' in freq_str: period = 12
    elif n > 14 and n < 100:
        period = 7 
    elif n >= 100:
        period = 12 

    period = min(period, max(2, n // 2 - 1))
    
    try:
        stl = STL(y, period=period, robust=True)
        res = stl.fit()
        
        trend = res.trend.tolist()
        seasonal = res.seasonal.tolist()
        resid = res.resid.tolist()
        observed = res.observed.tolist()
        
        var_resid = np.var(resid)
        var_orig = np.var(observed)
        var_trend_resid = np.var(res.trend + res.resid)
        var_seas_resid = np.var(res.seasonal + res.resid)
        
        trend_strength = max(0, 1 - var_resid / var_trend_resid) if var_trend_resid > 0 else 0
        seasonal_strength = max(0, 1 - var_resid / var_seas_resid) if var_seas_resid > 0 else 0
        signal_r2 = max(0, 1 - var_resid / var_orig) if var_orig > 0 else 0
        
    except Exception as e:
        logger.error(f"STL Decomposition failure: {e}")
        trend = observed = y.tolist()
        seasonal = [0]*n
        resid = [0]*n
        signal_r2 = 0.5
        trend_strength = 0
        seasonal_strength = 0

    try:
        y_diff = y.diff().dropna()
        nlags_acf = min(max(period + 2, 8), len(y_diff) // 2 - 1)
        acf_diff_vals = acf(y_diff, nlags=nlags_acf, fft=True)
        upper_lag = min(period, 12)
        mean_acf_diff = float(np.mean(np.abs(acf_diff_vals[1:upper_lag + 1])))
        f_persistence = min(1.0, max(0.0, (mean_acf_diff - 0.02) / 0.38))
    except Exception:
        f_persistence = 0.3

    f_signal = signal_r2
    mean_val = float(np.abs(y.mean()))
    cv = float(y.std() / mean_val) if mean_val > 1e-8 else 2.0
    f_stability = max(0.3, 1.0 - 0.7 * min((cv - 0.2) / 1.8, 1.0))
    f_length = min(1.0, max(0.3, (n - period) / (3 * period)))

    raw_score = (
        0.50 * f_persistence +
        0.25 * f_signal +
        0.15 * f_stability +
        0.10 * f_length
    )
    score_val = min(100.0, max(0.0, float(raw_score * 100)))

    if score_val >= 72:
        score_label = "High — Strong, repeatable structure. Good forecast conditions."
    elif score_val >= 45:
        score_label = "Moderate — Detectable patterns with meaningful uncertainty."
    elif score_val >= 22:
        score_label = "Low — Noisy or near-random. Forecasts carry high uncertainty."
    else:
        score_label = "Very Low — Near-random behavior. Use forecasts as wide scenarios only."

    nlags = min(40, n // 2 - 1)
    try:
        acf_vals = acf(y, nlags=nlags, fft=True).tolist()
        pacf_vals = pacf(y, nlags=nlags, method='ywm').tolist()
    except Exception as e:
        logger.error(f"ACF/PACF calculation error: {e}")
        acf_vals = []
        pacf_vals = []

    anomalies = []
    try:
        anomalies = detect_anomalies_isolation_forest(np.array(y), threshold=0.05)
    except Exception as e:
        logger.error(f"Anomaly detection execution error: {e}")

    changepoints = []
    try:
        signal = np.array(trend).reshape(-1, 1)
        algo = rpt.Binseg(model="l2").fit(signal)
        n_bkps = min(5, max(1, n // 100))
        result = algo.predict(n_bkps=n_bkps)
        if result and result[-1] == n:
            result = result[:-1]
        changepoints = result
    except Exception as e:
        logger.error(f"Changepoint detection error: {e}")

    try:
        adf_result = adfuller(y.dropna())
        adf_test = {
            "test_statistic": float(round(adf_result[0], 3)),
            "p_value": float(round(adf_result[1], 4)),
            "is_stationary": bool(adf_result[1] < 0.05)
        }
    except Exception as e:
        logger.error(f"ADF test error: {e}")
        adf_test = {
            "test_statistic": 0.0,
            "p_value": 1.0,
            "is_stationary": False
        }

    covariates = []
    try:
        covariates = analyze_covariates(df, date_col, target_col)
    except Exception as e:
        logger.error(f"Covariates calculation error inside diagnostics: {e}")

    dates = df.index.astype(str).tolist()

    logger.info("Diagnostics and statistical EDA computation complete.")
    return {
        "dates": dates,
        "stats": stats,
        "anomalies": anomalies,
        "changepoints": changepoints,
        "stl": {
            "observed": observed,
            "trend": trend,
            "seasonal": seasonal,
            "resid": resid
        },
        "forecastability": {
            "score": round(score_val, 1),
            "label": score_label,
            "trend_strength": round(trend_strength, 3),
            "seasonal_strength": round(seasonal_strength, 3)
        },
        "adf_test": adf_test,
        "acf": acf_vals,
        "pacf": pacf_vals,
        "covariates": covariates
    }
