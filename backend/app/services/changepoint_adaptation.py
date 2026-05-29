import logging
import numpy as np
import pandas as pd
import ruptures as rpt

logger = logging.getLogger("laplace.services.changepoint_adaptation")

def adapt_training_data_for_shocks(
    y: np.ndarray,
    df_clean: pd.DataFrame,
    period: int,
    date_col: str,
    target_col: str
) -> tuple[np.ndarray, pd.DataFrame, int | None]:
    """
    Analyzes the historical series for severe structural shocks (changepoints).
    If a recent, statistically severe regime shift is detected, trims the training history
    to start exactly after the shock onset, preventing classic model parameter distortion.
    
    Returns:
        tuple of (y_adapted, df_clean_adapted, shock_index_or_none)
    """
    n = len(y)
    # Require a minimum history to consider trimming
    if n < max(30, period * 3):
        return y, df_clean, None
        
    try:
        # 1. Smooth series to extract baseline trend (avoids seasonal false positives)
        trend = pd.Series(y).rolling(window=max(3, period), min_periods=1, center=True).mean().values
        signal = trend.reshape(-1, 1)
        
        # 2. Run Ruptures Binary Segmentation
        algo = rpt.Binseg(model="l2").fit(signal)
        n_bkps = min(5, max(1, n // 80))
        bkps = algo.predict(n_bkps=n_bkps)
        
        # Filter out the final index (ruptures always appends len(y) to bkps)
        changepoints = [b for b in bkps if b < n]
        if not changepoints:
            return y, df_clean, None
            
        # Get the latest changepoint
        latest_cp = changepoints[-1]
        
        # 3. Assess if changepoint is recent and severe
        # Recent check: between 40% and 85% of the timeline
        is_recent = (0.40 * n <= latest_cp <= 0.85 * n)
        if not is_recent:
            return y, df_clean, None
            
        y_before = y[:latest_cp]
        y_after = y[latest_cp:]
        
        mean_before = np.mean(y_before)
        mean_after = np.mean(y_after)
        std_overall = np.std(y)
        
        # Compute mean shift relative to overall standard deviation
        shift = abs(mean_after - mean_before) / (std_overall + 1e-8)
        
        # Shock threshold: shift greater than 1.5 standard deviations
        if shift >= 1.5:
            # 4. Verify post-break sample size is sufficient to train classic models safely
            min_post_break = max(15, period * 2)
            if len(y_after) >= min_post_break:
                logger.warning(
                    f"⚠️ DETECTED SEVERE STRUCTURAL SHOCK at index {latest_cp} "
                    f"({df_clean.iloc[latest_cp][date_col]}). Mean shift: {shift:.2f} std. "
                    f"Trimming training history to post-break regime ({len(y_after)} points remaining)."
                )
                return y_after, df_clean.iloc[latest_cp:].copy(), latest_cp
                
    except Exception as e:
        logger.error(f"Error during changepoint adaptive training check: {e}", exc_info=True)
        
    return y, df_clean, None
