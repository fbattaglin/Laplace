import pandas as pd
import numpy as np
import math
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import acf, pacf, adfuller
from sklearn.ensemble import IsolationForest
import ruptures as rpt
from scipy.stats import skew, kurtosis

def compute_diagnostics(df: pd.DataFrame, date_col: str, target_col: str):
    """
    Computes STL decomposition, ACF, PACF, Forecastability Score, Basic Stats, 
    Anomalies (Isolation Forest), and Changepoints (Ruptures).
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).set_index(date_col)
    
    # Pre-interpolation data for stats
    y_raw = df[target_col].astype(float)
    
    # Basic Stats
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
    
    # Interpolate
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
    
    # 1. STL Decomposition
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
        
        score_val = float(signal_r2 * 100)
        if n < period * 3:
            score_val *= 0.8 
            
        score_val = min(100.0, max(0.0, score_val))
        
        if score_val >= 75:
            score_label = "High — Strong signal with clear patterns."
        elif score_val >= 40:
            score_label = "Moderate — Detectable patterns but with noticeable noise."
        else:
            score_label = "Low — Highly noisy or irregular data."
            
    except Exception as e:
        print(f"STL Error: {e}")
        trend = observed = y.tolist()
        seasonal = [0]*n
        resid = [0]*n
        score_val = 50.0
        score_label = "Unknown — Error computing decomposition."
        trend_strength = 0
        seasonal_strength = 0

    # 2. ACF and PACF
    nlags = min(40, n // 2 - 1)
    try:
        acf_vals = acf(y, nlags=nlags, fft=True).tolist()
        pacf_vals = pacf(y, nlags=nlags, method='ywm').tolist()
    except:
        acf_vals = []
        pacf_vals = []

    # 3. Anomaly Detection (Isolation Forest)
    anomalies = []
    try:
        iso = IsolationForest(contamination=0.05, random_state=42)
        y_array = np.array(y).reshape(-1, 1)
        preds = iso.fit_predict(y_array)
        anomaly_indices = np.where(preds == -1)[0]
        anomalies = anomaly_indices.tolist()
    except Exception as e:
        print(f"Anomaly detection error: {e}")
        
    # 4. Trend Changepoints (Ruptures Binseg)
    changepoints = []
    try:
        # Binary segmentation on the trend or raw data
        # We use trend to avoid seasonal noise triggering changes
        signal = np.array(trend).reshape(-1, 1)
        algo = rpt.Binseg(model="l2").fit(signal)
        # 1 changepoint per 100 points roughly, max 5
        n_bkps = min(5, max(1, n // 100))
        result = algo.predict(n_bkps=n_bkps)
        # ruptures returns the index of the changepoints (end points of segments)
        # remove the last index which is just the length of the array
        if result and result[-1] == n:
            result = result[:-1]
        changepoints = result
    except Exception as e:
        print(f"Changepoint detection error: {e}")

    # 5. Stationarity Test (Augmented Dickey-Fuller)
    try:
        # We test stationarity on the interpolated series
        adf_result = adfuller(y.dropna())
        adf_test = {
            "test_statistic": float(round(adf_result[0], 3)),
            "p_value": float(round(adf_result[1], 4)),
            "is_stationary": bool(adf_result[1] < 0.05)
        }
    except Exception as e:
        print(f"ADF test error: {e}")
        adf_test = {
            "test_statistic": 0.0,
            "p_value": 1.0,
            "is_stationary": False
        }

    dates = df.index.astype(str).tolist()

    return {
        "dates": dates,
        "stats": stats,
        "anomalies": anomalies, # list of indices
        "changepoints": changepoints, # list of indices
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
        "pacf": pacf_vals
    }
