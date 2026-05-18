"""
Ensemble forecast: inverse-sMAPE weighted combination of all model outputs.

weights_i = (1 / smape_i) / sum(1 / smape_j)

All five models contribute; a model with lower sMAPE earns a higher weight.
If a model is missing from aggregate_metrics (e.g. failed during backtest),
it is excluded from the ensemble gracefully.
"""

import numpy as np

from laplace.models.schemas import Metrics, ModelForecast


_MIN_SMAPE = 1e-3  # guard against division by zero when sMAPE ≈ 0


def compute_ensemble(
    forecasts: list[ModelForecast],
    aggregate_metrics: dict[str, Metrics],
) -> ModelForecast:
    """
    Combine multiple ModelForecast objects into a single Ensemble forecast
    using inverse-sMAPE weighting derived from backtest aggregate_metrics.

    Parameters
    ----------
    forecasts: list[ModelForecast]
        Individual model forecasts (from run_all_models). Must be non-empty.
    aggregate_metrics: dict[str, Metrics]
        Per-model aggregate backtest metrics. Models not in this dict
        are assigned the worst (highest) sMAPE of the group.

    Returns
    -------
    ModelForecast with model_name="Ensemble"
    """
    if not forecasts:
        raise ValueError("compute_ensemble requires at least one forecast")

    # Build smape lookup; fall back to max observed sMAPE for unknown models
    known_smapes = {
        name: max(m.smape, _MIN_SMAPE)
        for name, m in aggregate_metrics.items()
    }
    fallback_smape = max(known_smapes.values()) if known_smapes else 10.0

    smapes = np.array([
        known_smapes.get(f.model_name, fallback_smape)
        for f in forecasts
    ])

    raw_weights = 1.0 / smapes
    weights = raw_weights / raw_weights.sum()  # normalise → sum = 1.0

    horizon = len(forecasts[0].point_forecast)

    def weighted_avg(attr: str) -> list[float]:
        matrix = np.array([
            getattr(f, attr)[:horizon] for f in forecasts
        ])  # shape: (n_models, horizon)
        result = (matrix * weights[:, None]).sum(axis=0)
        return [float(x) for x in result]

    return ModelForecast(
        model_name="Ensemble",
        point_forecast=weighted_avg("point_forecast"),
        lo_80=weighted_avg("lo_80"),
        hi_80=weighted_avg("hi_80"),
        lo_90=weighted_avg("lo_90"),
        hi_90=weighted_avg("hi_90"),
    )


def compute_weights(
    aggregate_metrics: dict[str, Metrics],
    model_names: list[str],
) -> dict[str, float]:
    """
    Return the ensemble weights as a dict {model_name: weight} for display.
    Same logic as compute_ensemble but without requiring actual forecasts.
    """
    if not model_names:
        return {}

    known_smapes = {
        name: max(m.smape, _MIN_SMAPE)
        for name, m in aggregate_metrics.items()
    }
    fallback_smape = max(known_smapes.values()) if known_smapes else 10.0

    smapes = np.array([
        known_smapes.get(name, fallback_smape)
        for name in model_names
    ])
    raw_weights = 1.0 / smapes
    weights = raw_weights / raw_weights.sum()

    return {name: float(w) for name, w in zip(model_names, weights)}
