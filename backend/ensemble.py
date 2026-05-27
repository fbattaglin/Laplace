"""
Ensemble Forecast Engine — Inverse-sMAPE Weighted Combiner

Combines top-N model predictions using weights proportional to 1/sMAPE.
Better models contribute more to the final forecast.
"""
import numpy as np
from typing import List, Dict, Any


def compute_ensemble_weights(metrics: List[Dict[str, Any]], top_n: int = 3) -> Dict[str, float]:
    """
    Compute inverse-sMAPE weights for the top-N models.
    
    Returns dict mapping model_name -> weight (weights sum to 1.0).
    Models with sMAPE=0 get capped at a large but finite inverse.
    """
    # Sort by sMAPE ascending (best first), take top N
    sorted_metrics = sorted(metrics, key=lambda m: m["sMAPE"])
    top_models = sorted_metrics[:top_n]
    
    # Inverse sMAPE (cap at 1/0.01 = 100 to avoid inf for perfect models)
    inverses = {}
    for m in top_models:
        smape_val = max(m["sMAPE"], 0.01)  # floor to prevent division by zero
        inverses[m["model"]] = 1.0 / smape_val
    
    total = sum(inverses.values())
    if total == 0:
        # Fallback: equal weights
        n = len(inverses)
        return {name: 1.0 / n for name in inverses}
    
    return {name: float(inv / total) for name, inv in inverses.items()}


def build_ensemble_prediction(
    weights: Dict[str, float],
    predictions: Dict[str, Any],
    h: int
) -> np.ndarray:
    """
    Build weighted average prediction from individual model predictions.
    
    Args:
        weights: model_name -> weight (sum to 1.0)
        predictions: dict containing model_name -> list of predictions
        h: forecast horizon
    
    Returns:
        numpy array of weighted average predictions, length h
    """
    ensemble = np.zeros(h)
    total_weight = 0.0
    
    for model_name, weight in weights.items():
        if model_name in predictions:
            preds = np.array(predictions[model_name][:h], dtype=float)
            if len(preds) == h:
                ensemble += float(weight) * preds
                total_weight += float(weight)
    
    # Renormalize if some models were missing from predictions
    if total_weight > 0 and total_weight < 0.99:
        ensemble /= total_weight
    
    return ensemble


def build_ensemble_from_validation(
    metrics: List[Dict[str, Any]],
    predictions: Dict[str, Any],
    y_test: np.ndarray,
    y_train: np.ndarray,
    period: int,
    top_n: int = 3
) -> Dict[str, Any]:
    """
    Full ensemble pipeline for the validation step.
    
    Returns the ensemble metrics dict + adds predictions to the payload.
    Returns None if fewer than 2 models are available.
    """
    # Need at least 2 models to make an ensemble worthwhile
    if len(metrics) < 2:
        return None
    
    weights = compute_ensemble_weights(metrics, top_n=top_n)
    h = len(y_test)
    ensemble_preds = build_ensemble_prediction(weights, predictions, h)
    
    # Compute metrics for the ensemble
    from validation import smape, mase, rmse
    
    e_smape = smape(y_test, ensemble_preds)
    e_mase = mase(y_test, ensemble_preds, y_train, period)
    e_rmse = rmse(y_test, ensemble_preds)
    
    ensemble_metrics = {
        "model": "Ensemble",
        "sMAPE": round(float(e_smape), 2),
        "MASE": round(float(e_mase), 3) if not np.isnan(e_mase) else 0.0,
        "RMSE": round(float(e_rmse), 2),
        "weights": {k: round(float(v), 3) for k, v in weights.items()},
        "component_models": list(weights.keys())
    }
    
    return ensemble_metrics, ensemble_preds


def build_ensemble_forecast(
    model_forecasts: Dict[str, Dict[str, np.ndarray]],
    weights: Dict[str, float],
    h: int
) -> tuple:
    """
    Build ensemble forecast from multiple model forecast outputs.
    
    Args:
        model_forecasts: model_name -> {"mean": array, "lower": array, "upper": array}
        weights: model_name -> weight
        h: horizon
    
    Returns:
        (mean, lower, upper) numpy arrays
    """
    mean = np.zeros(h)
    lower = np.zeros(h)
    upper = np.zeros(h)
    total_weight = 0.0
    
    for model_name, weight in weights.items():
        if model_name in model_forecasts:
            f = model_forecasts[model_name]
            mean += float(weight) * np.array(f["mean"][:h])
            lower += float(weight) * np.array(f["lower"][:h])
            upper += float(weight) * np.array(f["upper"][:h])
            total_weight += float(weight)
    
    if total_weight > 0 and total_weight < 0.99:
        mean /= total_weight
        lower /= total_weight
        upper /= total_weight
    
    return mean, lower, upper
