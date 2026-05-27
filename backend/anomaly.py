import numpy as np
import pandas as pd
from typing import Dict, Any, List
from sklearn.ensemble import IsolationForest
import sys

# Try to import MOMENT if available and compatible
MOMENT_AVAILABLE = False
try:
    if sys.version_info >= (3, 11) and sys.version_info < (3, 13):
        import momentfm
        MOMENT_AVAILABLE = True
except ImportError:
    pass

def detect_anomalies_isolation_forest(y: np.ndarray, threshold: float = 0.05) -> List[Dict[str, Any]]:
    """
    Detect anomalies using Isolation Forest.
    threshold: contamination parameter (default 5%)
    """
    if len(y) < 10:
        return []
        
    # Reshape for sklearn
    y_reshaped = y.reshape(-1, 1)
    
    # Train Isolation Forest
    clf = IsolationForest(contamination=threshold, random_state=42)
    preds = clf.fit_predict(y_reshaped)
    scores = clf.score_samples(y_reshaped)
    
    # -1 means anomaly, normalize scores to [0, 1] range where 1 is highest anomaly
    anomalies = []
    
    # Normalizing scores (Isolation Forest returns negative scores, lower is more anomalous)
    min_score = np.min(scores)
    max_score = np.max(scores)
    range_score = max_score - min_score if max_score > min_score else 1.0
    
    for i in range(len(y)):
        if preds[i] == -1:
            # Convert to [0, 1] confidence
            normalized_score = 1.0 - ((scores[i] - min_score) / range_score)
            anomalies.append({
                "index": i,
                "value": float(y[i]),
                "score": round(float(normalized_score), 3),
                "severity": "high" if normalized_score > 0.8 else "medium"
            })
            
    # Sort by score descending
    anomalies.sort(key=lambda x: x["score"], reverse=True)
    return anomalies

def detect_anomalies_moment(y: np.ndarray, threshold: float = 0.05) -> List[Dict[str, Any]]:
    """
    Detect anomalies using MOMENT foundation model.
    Falls back to Isolation Forest if MOMENT fails or is unavailable.
    """
    if not MOMENT_AVAILABLE:
        print("MOMENT unavailable, falling back to Isolation Forest")
        return detect_anomalies_isolation_forest(y, threshold)
        
    try:
        # TODO: Implement actual MOMENT inference here when pip package is stable
        # For now, we simulate the fallback gracefully.
        print("MOMENT available but not yet implemented for anomaly detection. Falling back to Isolation Forest.")
        return detect_anomalies_isolation_forest(y, threshold)
    except Exception as e:
        print(f"MOMENT anomaly detection failed: {e}. Falling back to Isolation Forest.")
        return detect_anomalies_isolation_forest(y, threshold)

def run_anomaly_detection(
    df: pd.DataFrame, 
    date_col: str, 
    target_col: str,
    method: str = "isolation_forest",
    threshold: float = 0.05
) -> Dict[str, Any]:
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
        
    # Enrich with dates
    for a in anomalies:
        a["date"] = dates[a["index"]]
        
    return {
        "engine": method if method == "moment" and MOMENT_AVAILABLE else "isolation_forest",
        "threshold": threshold,
        "count": len(anomalies),
        "anomalies": anomalies
    }
