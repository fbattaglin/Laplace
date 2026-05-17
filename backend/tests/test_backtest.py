import numpy as np
import pytest

from laplace.services.backtest import compute_metrics, rolling_origin_cv


class TestComputeMetrics:
    def test_perfect_forecast(self):
        actual = np.array([10.0, 20.0, 30.0])
        predicted = np.array([10.0, 20.0, 30.0])
        m = compute_metrics(actual, predicted, seasonal_naive_mae=5.0)
        assert m.mae == 0.0
        assert m.rmse == 0.0
        assert m.smape == 0.0
        assert m.mase == 0.0

    def test_known_values(self):
        actual = np.array([100.0, 200.0, 300.0])
        predicted = np.array([110.0, 190.0, 310.0])
        m = compute_metrics(actual, predicted, seasonal_naive_mae=15.0)
        assert abs(m.mae - 10.0) < 0.01
        assert m.mape is not None
        assert abs(m.mape - 6.11) < 0.1
        assert m.mase == pytest.approx(10.0 / 15.0, abs=0.01)

    def test_zeros_in_actual_skip_mape(self):
        actual = np.array([0.0, 10.0, 20.0])
        predicted = np.array([1.0, 11.0, 21.0])
        m = compute_metrics(actual, predicted, seasonal_naive_mae=5.0)
        assert m.mape is None
        assert m.smape > 0

    def test_smape_bounded(self):
        actual = np.array([10.0, 20.0, 30.0])
        predicted = np.array([100.0, 200.0, 300.0])
        m = compute_metrics(actual, predicted, seasonal_naive_mae=5.0)
        assert 0 <= m.smape <= 200

    def test_mase_infinity_when_no_baseline(self):
        actual = np.array([10.0, 20.0])
        predicted = np.array([11.0, 21.0])
        m = compute_metrics(actual, predicted, seasonal_naive_mae=0.0)
        assert m.mase == float("inf")


class TestRollingOriginCV:
    def test_basic_run(self):
        np.random.seed(42)
        t = np.arange(100)
        values = (100 + 2 * t + 20 * np.sin(2 * np.pi * t / 12)).tolist()
        result = rolling_origin_cv(values, frequency="M", horizon=12, n_splits=3)
        assert result.n_splits == 3
        assert len(result.folds) == 3
        assert result.winner in result.aggregate_metrics
        assert result.selection_metric == "smape"

    def test_folds_have_correct_structure(self):
        np.random.seed(42)
        t = np.arange(100)
        values = (100 + 2 * t).tolist()
        result = rolling_origin_cv(values, frequency="M", horizon=12, n_splits=2)
        for fold in result.folds:
            assert len(fold.actual) == 12
            assert len(fold.forecasts) > 0
            for mf in fold.forecasts:
                assert len(mf.point_forecast) == 12

    def test_expanding_window(self):
        np.random.seed(42)
        t = np.arange(120)
        values = (50 + t).tolist()
        result = rolling_origin_cv(values, frequency="M", horizon=12, n_splits=3)
        train_ends = [f.train_end_idx for f in result.folds]
        assert train_ends == sorted(train_ends)

    def test_too_few_points_raises(self):
        values = list(range(15))
        with pytest.raises(ValueError, match="Not enough data"):
            rolling_origin_cv(values, frequency="M", horizon=12, n_splits=3)

    def test_winner_has_lowest_smape(self):
        np.random.seed(42)
        t = np.arange(100)
        values = (100 + 2 * t + 20 * np.sin(2 * np.pi * t / 12)).tolist()
        result = rolling_origin_cv(values, frequency="M", horizon=12, n_splits=2)
        winner_smape = result.aggregate_metrics[result.winner].smape
        for _name, m in result.aggregate_metrics.items():
            assert m.smape >= winner_smape

    def test_daily_frequency(self):
        np.random.seed(0)
        t = np.arange(100)
        values = (50 + 10 * np.sin(2 * np.pi * t / 7)).tolist()
        result = rolling_origin_cv(values, frequency="D", horizon=7, n_splits=2)
        assert result.n_splits >= 1
        assert result.horizon == 7
