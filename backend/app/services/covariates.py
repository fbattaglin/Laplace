import pandas as pd
import numpy as np

def analyze_covariates(df: pd.DataFrame, date_col: str, target_col: str) -> list[dict[str, any]]:
    """
    Auto-detect numeric covariate columns in the dataset and compute their Pearson correlation with the target.
    Excludes the date and target columns.
    """
    covariate_candidates = []
    
    if target_col not in df.columns:
        return covariate_candidates
        
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    
    if target_col in numeric_cols:
        numeric_cols.remove(target_col)
        
    if date_col in numeric_cols:
        numeric_cols.remove(date_col)
        
    target_series = pd.to_numeric(df[target_col], errors='coerce')
    
    for col in numeric_cols:
        col_series = pd.to_numeric(df[col], errors='coerce')
        valid_idx = target_series.notna() & col_series.notna()
        if valid_idx.sum() > 2:
            corr = np.corrcoef(target_series[valid_idx], col_series[valid_idx])[0, 1]
            if np.isnan(corr):
                corr = 0.0
        else:
            corr = 0.0
            
        covariate_candidates.append({
            "column": col,
            "correlation": round(float(corr), 3),
            "suggested_type": "known_future" if "holiday" in col.lower() or "event" in col.lower() else "past_only"
        })
        
    covariate_candidates.sort(key=lambda x: abs(x["correlation"]), reverse=True)
    return covariate_candidates

def align_covariates(
    history_df: pd.DataFrame, 
    horizon: int, 
    covariate_cols: list[str]
) -> dict[str, any]:
    """
    Extract covariates from the history DataFrame.
    """
    if not covariate_cols:
        return {"past_covariates": None}
        
    valid_cols = [c for c in covariate_cols if c in history_df.columns]
    if not valid_cols:
        return {"past_covariates": None}
        
    past_covariates = history_df[valid_cols].values.astype(np.float32)
    return {
        "past_covariates": past_covariates,
        "columns": valid_cols
    }
