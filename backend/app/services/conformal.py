import logging
import numpy as np
import pandas as pd

logger = logging.getLogger("laplace.services.conformal")

def compute_conformal_interval_half_width(
    y: np.ndarray,
    model_name: str,
    h: int,
    period: int,
    freq_str: str,
    df: pd.DataFrame,
    date_col: str,
    covariate_cols: list = None,
    level: float = 80.0
) -> float | None:
    """
    Computes the conformal prediction interval half-width using a rolling calibration split.
    Uses the last min(30, 20% of data) points of the training data as a calibration set.
    """
    n = len(y)
    cal_size = max(5, min(30, int(n * 0.20)))
    
    # Ensure training set has enough history to fit the models
    min_train = max(10, period * 2)
    if n - cal_size < min_train:
        logger.warning(f"Series too short for conformal calibration (N={n}, cal_size={cal_size}). Falling back to baseline.")
        return None
        
    try:
        # Ensure dates are parsed to datetime objects
        df = df.copy()
        df[date_col] = pd.to_datetime(df[date_col])
        
        # Split history into training and calibration sets
        y_train = y[:-cal_size]
        y_cal = y[-cal_size:]
        df_train = df.iloc[:-cal_size]
        
        # Import single model runner from forecast service
        from app.services.forecast import _run_single_model
        
        res = _run_single_model(
            model_name=model_name,
            y=y_train,
            h=cal_size,
            period=period,
            freq_str=freq_str,
            df=df_train,
            date_col=date_col,
            covariate_cols=covariate_cols
        )
        
        if res is None or "mean" not in res:
            logger.warning(f"Could not get single model forecast for conformal calibration: {model_name}")
            return None
            
        preds_cal = np.array(res["mean"])
        
        # Compute absolute residuals
        residuals = np.abs(y_cal - preds_cal)
        
        # Calculate conformal quantile
        alpha = (100.0 - level) / 100.0
        conformal_score = np.percentile(residuals, (1.0 - alpha) * 100.0)
        
        logger.info(f"Conformal prediction successfully calibrated for model {model_name} (width={conformal_score:.4f}, level={level}%)")
        return float(conformal_score)
        
    except Exception as e:
        logger.error(f"Error computing conformal interval for {model_name}: {e}", exc_info=True)
        return None
