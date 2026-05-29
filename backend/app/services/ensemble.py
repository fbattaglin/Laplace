import numpy as np

def compute_ensemble_weights(metrics: list[dict[str, any]], top_n: int = 3) -> dict[str, float]:
    """
    Compute inverse-sMAPE weights for the top-N models.
    """
    sorted_metrics = sorted(metrics, key=lambda m: m["sMAPE"])
    top_models = sorted_metrics[:top_n]
    
    inverses = {}
    for m in top_models:
        smape_val = max(m["sMAPE"], 0.01)
        inverses[m["model"]] = 1.0 / smape_val
    
    total = sum(inverses.values())
    if total == 0:
        n = len(inverses)
        return {name: 1.0 / n for name in inverses}
    
    return {name: float(inv / total) for name, inv in inverses.items()}

def build_ensemble_prediction(
    weights: dict[str, float],
    predictions: dict[str, any],
    h: int
) -> np.ndarray:
    """
    Build weighted average prediction from individual model predictions.
    """
    ensemble = np.zeros(h)
    total_weight = 0.0
    
    for model_name, weight in weights.items():
        if model_name in predictions:
            preds = np.array(predictions[model_name][:h], dtype=float)
            if len(preds) == h:
                ensemble += float(weight) * preds
                total_weight += float(weight)
    
    if total_weight > 0 and total_weight < 0.99:
        ensemble /= total_weight
    
    return ensemble

def build_ensemble_from_validation(
    metrics: list[dict[str, any]],
    predictions: dict[str, any],
    y_test: np.ndarray,
    y_train: np.ndarray,
    period: int,
    top_n: int = 3,
    ensemble_config: dict[str, any] | None = None
) -> tuple[dict[str, any], np.ndarray] | None:
    """
    Full ensemble pipeline for the validation step.
    """
    if len(metrics) < 2:
        return None
    
    strategy = "inverse_smape"
    custom_weights = None
    if ensemble_config:
        strategy = ensemble_config.get("strategy", "inverse_smape")
        custom_weights = ensemble_config.get("custom_weights", None)
        
    weights = {}
    if strategy == "custom" and custom_weights:
        valid_custom = {k: float(v) for k, v in custom_weights.items() if any(m["model"] == k for m in metrics)}
        if valid_custom:
            total = sum(valid_custom.values())
            if total > 0:
                weights = {k: v / total for k, v in valid_custom.items()}
            else:
                weights = {k: 1.0 / len(valid_custom) for k in valid_custom}
        else:
            strategy = "inverse_smape"
            
    if strategy == "equal":
        sorted_metrics = sorted([m for m in metrics if m["model"] != "Ensemble"], key=lambda m: m["sMAPE"])
        top_models = [m["model"] for m in sorted_metrics[:top_n]]
        n = len(top_models)
        weights = {m: 1.0 / n for m in top_models}
        
    if not weights or strategy == "inverse_smape":
        clean_metrics = [m for m in metrics if m["model"] != "Ensemble"]
        weights = compute_ensemble_weights(clean_metrics, top_n=top_n)
        
    h = len(y_test)
    ensemble_preds = build_ensemble_prediction(weights, predictions, h)
    
    from app.services.validation import smape, mase, rmse
    
    e_smape = smape(y_test, ensemble_preds)
    e_mase = mase(y_test, ensemble_preds, y_train, period)
    e_rmse = rmse(y_test, ensemble_preds)
    
    ensemble_metrics = {
        "model": "Ensemble",
        "sMAPE": round(float(e_smape), 2),
        "MASE": round(float(e_mase), 3) if not np.isnan(e_mase) else 0.0,
        "RMSE": round(float(e_rmse), 2),
        "weights": {k: round(float(v), 3) for k, v in weights.items()},
        "component_models": list(weights.keys()),
        "strategy": strategy
    }
    
    return ensemble_metrics, ensemble_preds

def build_ensemble_forecast(
    model_forecasts: dict[str, dict[str, np.ndarray]],
    weights: dict[str, float],
    h: int
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Build ensemble forecast from multiple model forecast outputs.
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
