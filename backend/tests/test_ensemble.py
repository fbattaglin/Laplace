"""Tests for the ensemble forecast service."""

import pytest
import numpy as np

from laplace.models.schemas import Metrics, ModelForecast
from laplace.services.ensemble import compute_ensemble, compute_weights


def make_forecast(name: str, horizon: int = 6, base: float = 100.0) -> ModelForecast:
    """Helper: create a ModelForecast with deterministic values."""
    point = [base + i for i in range(horizon)]
    return ModelForecast(
        model_name=name,
        point_forecast=point,
        lo_80=[v - 5 for v in point],
        hi_80=[v + 5 for v in point],
        lo_90=[v - 10 for v in point],
        hi_90=[v + 10 for v in point],
    )


def make_metrics(smape: float) -> Metrics:
    return Metrics(mae=1.0, rmse=1.5, smape=smape, mase=1.0)


class TestComputeEnsemble:
    def test_weights_sum_to_one(self):
        """Ensemble weights must always sum to exactly 1.0."""
        forecasts = [
            make_forecast("ModelA"),
            make_forecast("ModelB"),
            make_forecast("ModelC"),
        ]
        metrics = {
            "ModelA": make_metrics(5.0),
            "ModelB": make_metrics(10.0),
            "ModelC": make_metrics(20.0),
        }
        result = compute_ensemble(forecasts, metrics)
        # Verify by recomputing weights
        weights = compute_weights(metrics, ["ModelA", "ModelB", "ModelC"])
        assert abs(sum(weights.values()) - 1.0) < 1e-10

    def test_weighted_average_correctness(self):
        """Hand-compute expected output and verify against compute_ensemble."""
        # Two models: A with smape=4 (weight 1/4), B with smape=2 (weight 1/2)
        # normalised: w_A = (1/4) / (1/4 + 1/2) = 1/3, w_B = 2/3
        fA = make_forecast("A", horizon=3, base=100.0)  # point: [100, 101, 102]
        fB = make_forecast("B", horizon=3, base=200.0)  # point: [200, 201, 202]
        metrics = {"A": make_metrics(4.0), "B": make_metrics(2.0)}

        result = compute_ensemble([fA, fB], metrics)

        expected = [
            100 * (1 / 3) + 200 * (2 / 3),
            101 * (1 / 3) + 201 * (2 / 3),
            102 * (1 / 3) + 202 * (2 / 3),
        ]
        for got, exp in zip(result.point_forecast, expected):
            assert abs(got - exp) < 1e-8

    def test_zero_smape_handled(self):
        """sMAPE=0 must not cause division by zero."""
        forecasts = [make_forecast("Perfect"), make_forecast("Mediocre")]
        metrics = {
            "Perfect": make_metrics(0.0),   # should be clamped to _MIN_SMAPE
            "Mediocre": make_metrics(10.0),
        }
        result = compute_ensemble(forecasts, metrics)
        # Should not raise, and point_forecast should be finite
        assert all(np.isfinite(v) for v in result.point_forecast)

    def test_ensemble_quantile_bounds(self):
        """lo_80 ≤ point_forecast ≤ hi_80 for every step (approximately)."""
        # Since we're averaging monotone bands, this should hold when
        # each individual model satisfies it.
        forecasts = [
            make_forecast("A", horizon=5, base=50.0),
            make_forecast("B", horizon=5, base=80.0),
        ]
        metrics = {"A": make_metrics(3.0), "B": make_metrics(6.0)}
        result = compute_ensemble(forecasts, metrics)

        for lo, pt, hi in zip(result.lo_80, result.point_forecast, result.hi_80):
            assert lo <= pt <= hi, f"Quantile monotonicity violated: {lo} ≤ {pt} ≤ {hi}"

    def test_model_name_is_ensemble(self):
        result = compute_ensemble([make_forecast("X")], {"X": make_metrics(5.0)})
        assert result.model_name == "Ensemble"

    def test_empty_forecasts_raises(self):
        with pytest.raises(ValueError, match="at least one forecast"):
            compute_ensemble([], {})

    def test_missing_model_in_metrics_uses_fallback(self):
        """A model not in aggregate_metrics should get the worst (highest) sMAPE."""
        forecasts = [make_forecast("Known"), make_forecast("Unknown")]
        metrics = {"Known": make_metrics(5.0)}
        # Unknown gets smape=5.0 (same as Known since it's the only one), so equal weights
        result = compute_ensemble(forecasts, metrics)
        # Just verify it doesn't crash and returns valid output
        assert len(result.point_forecast) == 6


class TestComputeWeights:
    def test_lower_smape_gets_higher_weight(self):
        metrics = {
            "Good": make_metrics(2.0),
            "Bad": make_metrics(20.0),
        }
        weights = compute_weights(metrics, ["Good", "Bad"])
        assert weights["Good"] > weights["Bad"]

    def test_equal_smape_equal_weights(self):
        metrics = {
            "A": make_metrics(5.0),
            "B": make_metrics(5.0),
        }
        weights = compute_weights(metrics, ["A", "B"])
        assert abs(weights["A"] - weights["B"]) < 1e-10

    def test_empty_returns_empty(self):
        assert compute_weights({}, []) == {}
