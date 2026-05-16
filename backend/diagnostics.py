import pandas as pd
import numpy as np
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import acf, pacf

def compute_diagnostics(df: pd.DataFrame, date_col: str, target_col: str):
    """
    Computes STL decomposition, ACF, PACF, and a Forecastability Score.
    """
    # Prepare data
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(date_col).set_index(date_col)
    
    y = df[target_col].astype(float).interpolate(method='linear').bfill().ffill()
    n = len(y)
    
    # Infer period heuristically or default to a reasonable value
    inferred_freq = pd.infer_freq(df.index)
    
    # Simple mapping of freq to period length for STL
    period = 12 # Default to monthly/yearly pattern for unknown
    if inferred_freq:
        freq_str = str(inferred_freq).lower()
        if 'd' in freq_str: period = 7
        elif 'h' in freq_str: period = 24
        elif 'q' in freq_str: period = 4
        elif 'm' in freq_str: period = 12
    elif n > 14 and n < 100:
        period = 7 # Guess weekly
    elif n >= 100:
        period = 12 # Guess monthly

    # Ensure period is strictly less than n/2
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
        
        # 2. Forecastability Score
        # Trend strength: max(0, 1 - Var(R)/Var(T+R))
        trend_strength = max(0, 1 - var_resid / var_trend_resid) if var_trend_resid > 0 else 0
        
        # Seasonal strength: max(0, 1 - Var(R)/Var(S+R))
        seasonal_strength = max(0, 1 - var_resid / var_seas_resid) if var_seas_resid > 0 else 0
        
        # Overall signal strength (R^2 of T+S)
        signal_r2 = max(0, 1 - var_resid / var_orig) if var_orig > 0 else 0
        
        # Base score 0-100
        score_val = float(signal_r2 * 100)
        
        # Penalize for small data
        if n < period * 3:
            score_val *= 0.8 # 20% penalty
            
        score_val = min(100.0, max(0.0, score_val))
        
        if score_val >= 75:
            score_label = "High — Strong signal with clear patterns."
        elif score_val >= 40:
            score_label = "Moderate — Detectable patterns but with noticeable noise."
        else:
            score_label = "Low — Highly noisy or irregular data."
            
    except Exception as e:
        print(f"STL Error: {e}")
        # Fallbacks
        trend = observed = y.tolist()
        seasonal = [0]*n
        resid = [0]*n
        score_val = 50.0
        score_label = "Unknown — Error computing decomposition."
        trend_strength = 0
        seasonal_strength = 0

    # 3. ACF and PACF
    nlags = min(40, n // 2 - 1)
    try:
        acf_vals = acf(y, nlags=nlags, fft=True).tolist()
        pacf_vals = pacf(y, nlags=nlags, method='ywm').tolist()
    except:
        acf_vals = []
        pacf_vals = []

    # Dates as strings for frontend
    dates = df.index.astype(str).tolist()

    return {
        "dates": dates,
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
        "acf": acf_vals,
        "pacf": pacf_vals
    }
