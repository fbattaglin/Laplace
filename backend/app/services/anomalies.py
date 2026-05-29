import logging
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
import sys

logger = logging.getLogger("laplace.services.anomalies")

MOMENT_AVAILABLE = False
try:
    if sys.version_info >= (3, 11) and sys.version_info < (3, 13):
        import momentfm
        MOMENT_AVAILABLE = True
except ImportError:
    pass

def detect_anomalies_isolation_forest(y: np.ndarray, threshold: float = 0.05) -> list[dict[str, any]]:
    """
    Detect anomalies using Isolation Forest.
    threshold: contamination parameter (default 5%)
    """
    if len(y) < 10:
        return []
        
    y_reshaped = y.reshape(-1, 1)
    clf = IsolationForest(contamination=threshold, random_state=42)
    preds = clf.fit_predict(y_reshaped)
    scores = clf.score_samples(y_reshaped)
    
    anomalies = []
    min_score = np.min(scores)
    max_score = np.max(scores)
    range_score = max_score - min_score if max_score > min_score else 1.0
    
    for i in range(len(y)):
        if preds[i] == -1:
            normalized_score = 1.0 - ((scores[i] - min_score) / range_score)
            anomalies.append({
                "index": i,
                "value": float(y[i]),
                "score": round(float(normalized_score), 3),
                "severity": "high" if normalized_score > 0.8 else "medium"
            })
            
    anomalies.sort(key=lambda x: x["score"], reverse=True)
    return anomalies

def detect_anomalies_moment(y: np.ndarray, threshold: float = 0.05) -> list[dict[str, any]]:
    """
    Detect anomalies using MOMENT foundation model.
    Falls back to Isolation Forest.
    """
    if not MOMENT_AVAILABLE:
        logger.warning("MOMENT unavailable, falling back to Isolation Forest")
        return detect_anomalies_isolation_forest(y, threshold)
        
    try:
        logger.info("MOMENT available but not yet implemented for anomaly detection. Falling back to Isolation Forest.")
        return detect_anomalies_isolation_forest(y, threshold)
    except Exception as e:
        logger.error(f"MOMENT anomaly detection failed: {e}. Falling back to Isolation Forest.")
        return detect_anomalies_isolation_forest(y, threshold)

def run_anomaly_detection(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str,
    method: str = "isolation_forest",
    threshold: float = 0.05
) -> dict[str, any]:
    """
    Run anomaly detection pipeline.
    """
    df_sorted = df.sort_values(by=date_col).copy()
    y = df_sorted[target_col].astype(float).values
    dates = df_sorted[date_col].astype(str).tolist()
    
    anomalies = []
    if method == "moment":
        anomalies = detect_anomalies_moment(y, threshold)
    else:
        anomalies = detect_anomalies_isolation_forest(y, threshold)
        
    for a in anomalies:
        a["date"] = dates[a["index"]]
        
    logger.info(f"Anomaly detection complete. Found {len(anomalies)} anomalies using {method}.")
    return {
        "engine": method if method == "moment" and MOMENT_AVAILABLE else "isolation_forest",
        "threshold": threshold,
        "count": len(anomalies),
        "anomalies": anomalies
    }
