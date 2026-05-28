import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple
from scipy.stats import boxcox
from scipy.special import inv_boxcox

def handle_missing_values(y: np.ndarray, method: str = "linear") -> np.ndarray:
    """
    Fill missing values in the array.
    Methods: 'linear', 'ffill', 'bfill', 'zero'
    """
    s = pd.Series(y)
    if method == "linear":
        s = s.interpolate(method='linear').bfill().ffill()
    elif method == "ffill":
        s = s.ffill().bfill()
    elif method == "bfill":
        s = s.bfill().ffill()
    elif method == "zero":
        s = s.fillna(0)
    return s.values

def remove_outliers(y: np.ndarray, method: str = "iqr", threshold: float = 1.5) -> np.ndarray:
    """
    Detect outliers and replace them with NaN, then interpolate linearly.
    Methods: 'iqr', 'zscore'
    """
    s = pd.Series(y)
    mask = pd.Series([False] * len(s))
    
    if method == "iqr":
        Q1 = s.quantile(0.25)
        Q3 = s.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - threshold * IQR
        upper_bound = Q3 + threshold * IQR
        mask = (s < lower_bound) | (s > upper_bound)
        
    elif method == "zscore":
        mean = s.mean()
        std = s.std()
        if std > 0:
            z_scores = np.abs((s - mean) / std)
            mask = z_scores > threshold

    if mask.any():
        s_clean = s.copy()
        s_clean[mask] = np.nan
        s_clean = s_clean.interpolate(method='linear').bfill().ffill()
        return s_clean.values
    
    return y

def apply_smoothing(y: np.ndarray, method: str = "sma", window: int = 3) -> np.ndarray:
    """
    Smooth the series.
    Methods: 'sma' (Simple Moving Average), 'ewm' (Exponential Weighted Moving Average)
    """
    if window <= 1:
        return y
        
    s = pd.Series(y)
    if method == "sma":
        return s.rolling(window=window, min_periods=1, center=True).mean().values
    elif method == "ewm":
        return s.ewm(span=window, min_periods=1).mean().values
    return y

def apply_variance_transform(y: np.ndarray, method: str = "log") -> Tuple[np.ndarray, dict]:
    """
    Apply variance stabilizing transform.
    Returns: (transformed_array, transform_params)
    Methods: 'log', 'boxcox'
    """
    # Shift to ensure all values are positive
    min_val = np.min(y)
    shift = abs(min_val) + 1.0 if min_val <= 0 else 0.0
    
    y_shifted = y + shift
    
    if method == "log":
        y_tf = np.log(y_shifted)
        return y_tf, {"method": "log", "shift": shift}
        
    elif method == "boxcox":
        y_tf, lam = boxcox(y_shifted)
        return y_tf, {"method": "boxcox", "shift": shift, "lambda": lam}
        
    return y, {"method": "none", "shift": 0.0}

def inverse_variance_transform(y_tf: np.ndarray, params: dict) -> np.ndarray:
    """
    Reverse the variance transform using the saved parameters.
    """
    method = params.get("method", "none")
    shift = params.get("shift", 0.0)
    
    if method == "log":
        y_inv = np.exp(y_tf)
    elif method == "boxcox":
        lam = params.get("lambda", 1.0)
        y_inv = inv_boxcox(y_tf, lam)
    else:
        y_inv = y_tf
        
    return y_inv - shift

def run_cleaning_pipeline(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str,
    config: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Execute a pipeline of cleaning steps in order.
    
    config example:
    [
      {"type": "missing", "method": "linear"},
      {"type": "outlier", "method": "iqr", "threshold": 1.5},
      {"type": "smooth", "method": "sma", "window": 7},
      {"type": "variance", "method": "log"}
    ]
    
    Returns:
        "cleaned_data": The fully cleaned series as a list
        "variance_params": The parameters needed to invert the variance transform (if any)
        "steps_log": Log of what was applied
    """
    # Sort and extract target
    df_sorted = df.sort_values(by=date_col).copy()
    y = df_sorted[target_col].astype(float).values
    
    steps_log = []
    variance_params = {"method": "none", "shift": 0.0}
    
    y_current = y.copy()
    
    for step in config:
        step_type = step.get("type")
        
        if step_type == "missing":
            method = step.get("method", "linear")
            y_current = handle_missing_values(y_current, method=method)
            steps_log.append(f"Filled missing values using {method}")
            
        elif step_type == "outlier":
            method = step.get("method", "iqr")
            threshold = step.get("threshold", 1.5)
            y_current = remove_outliers(y_current, method=method, threshold=threshold)
            steps_log.append(f"Removed outliers using {method} (threshold={threshold})")
            
        elif step_type == "smooth":
            method = step.get("method", "sma")
            window = int(step.get("window", 3))
            y_current = apply_smoothing(y_current, method=method, window=window)
            steps_log.append(f"Applied {method} smoothing (window={window})")
            
        elif step_type == "variance":
            method = step.get("method", "log")
            if method != "none":
                y_current, variance_params = apply_variance_transform(y_current, method=method)
                steps_log.append(f"Applied {method} variance transform")

    return {
        "cleaned_data": y_current.tolist(),
        "variance_params": variance_params,
        "steps_log": steps_log
    }

def preprocess_dataframe_for_modeling(
    df: pd.DataFrame,
    date_col: str,
    target_col: str,
    cleaning_config: List[Dict[str, Any]] = None,
    excluded_anomalies: List[int] = None
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Applies the selected data prep transformations (cleaning_config) and 
    anomaly exclusions (excluded_anomalies) to the target column in the DataFrame.
    
    Returns:
        (preprocessed_df, variance_params)
    """
    df = df.copy()
    df[date_col] = pd.to_datetime(df[date_col])
    df = df.sort_values(by=date_col)
    
    # 1. Handle anomaly exclusions
    if excluded_anomalies:
        y = df[target_col].astype(float).values.copy()
        for idx in excluded_anomalies:
            if 0 <= idx < len(y):
                y[idx] = np.nan
        df[target_col] = y
        # Interpolate NaNs resulting from anomaly exclusion
        df[target_col] = df[target_col].interpolate(method='linear').bfill().ffill()
        
    variance_params = {"method": "none", "shift": 0.0}
    
    # 2. Apply cleaning pipeline config if provided
    if cleaning_config:
        y_clean = df[target_col].astype(float).values.copy()
        
        for step in cleaning_config:
            step_type = step.get("type")
            if step_type == "missing":
                method = step.get("method", "linear")
                y_clean = handle_missing_values(y_clean, method=method)
            elif step_type == "outlier":
                method = step.get("method", "iqr")
                threshold = step.get("threshold", 1.5)
                y_clean = remove_outliers(y_clean, method=method, threshold=threshold)
            elif step_type == "smooth":
                method = step.get("method", "sma")
                window = int(step.get("window", 3))
                y_clean = apply_smoothing(y_clean, method=method, window=window)
            elif step_type == "variance":
                method = step.get("method", "log")
                if method != "none":
                    y_clean, variance_params = apply_variance_transform(y_clean, method=method)
                    
        df[target_col] = y_clean
        
    # 3. Safety Fallback: Ensure no NaNs or Infs remain in the target column
    y_final = df[target_col].astype(float).values.copy()
    if np.isnan(y_final).any() or np.isinf(y_final).any():
        print("[Safety Fallback] Target column contains NaNs/Infs. Automatically applying linear interpolation to ensure pipeline convergence.")
        y_final = handle_missing_values(y_final, method="linear")
        df[target_col] = y_final
        
    return df, variance_params
