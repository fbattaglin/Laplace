import numpy as np
import pytest

from laplace.services.forecasting import run_all_models, run_chronos, run_statsforecast, run_timesfm


@pytest.fixture
def synthetic_monthly():
    np.random.seed(42)
    t = np.arange(100)
    return (100 + 2 * t + 20 * np.sin(2 * np.pi * t / 12) + np.random.normal(0, 5, 100)).tolist()


class TestChronos:
    def test_produces_correct_horizon(self, synthetic_monthly):
        result = run_chronos(synthetic_monthly, horizon=12)
        assert result.model_name == "Chronos-2"
        assert len(result.point_forecast) == 12
        assert len(result.lo_90) == 12
        assert len(result.hi_90) == 12

    def test_intervals_ordered(self, synthetic_monthly):
        result = run_chronos(synthetic_monthly, horizon=6)
        for i in range(6):
            assert result.lo_90[i] <= result.lo_80[i]
            assert result.lo_80[i] <= result.point_forecast[i]
            assert result.point_forecast[i] <= result.hi_80[i]
            assert result.hi_80[i] <= result.hi_90[i]

    def test_short_series(self):
        values = list(range(20, 40))
        result = run_chronos(values, horizon=5)
        assert len(result.point_forecast) == 5

    def test_constant_series_no_crash(self):
        values = [50.0] * 30
        result = run_chronos(values, horizon=5)
        assert len(result.point_forecast) == 5
        assert all(np.isfinite(v) for v in result.point_forecast)


class TestTimesFM:
    def test_produces_correct_horizon(self, synthetic_monthly):
        result = run_timesfm(synthetic_monthly, horizon=12)
        assert result.model_name == "TimesFM"
        assert len(result.point_forecast) == 12
        assert len(result.lo_90) == 12
        assert len(result.hi_90) == 12

    def test_intervals_ordered(self, synthetic_monthly):
        result = run_timesfm(synthetic_monthly, horizon=6)
        for i in range(6):
            assert result.lo_90[i] <= result.lo_80[i]
            assert result.lo_80[i] <= result.point_forecast[i]
            assert result.point_forecast[i] <= result.hi_80[i]
            assert result.hi_80[i] <= result.hi_90[i]

    def test_short_series(self):
        values = list(range(20, 40))
        result = run_timesfm(values, horizon=5)
        assert len(result.point_forecast) == 5

    def test_constant_series_no_crash(self):
        values = [50.0] * 30
        result = run_timesfm(values, horizon=5)
        assert len(result.point_forecast) == 5
        assert all(np.isfinite(v) for v in result.point_forecast)


class TestStatsForecast:
    def test_produces_three_models(self, synthetic_monthly):
        results = run_statsforecast(synthetic_monthly, horizon=12, frequency="M")
        assert len(results) == 3
        names = {r.model_name for r in results}
        assert names == {"AutoETS", "AutoTheta", "SeasonalNaive"}

    def test_correct_horizon(self, synthetic_monthly):
        results = run_statsforecast(synthetic_monthly, horizon=8, frequency="M")
        for r in results:
            assert len(r.point_forecast) == 8
            assert len(r.lo_90) == 8
            assert len(r.hi_90) == 8

    def test_intervals_ordered(self, synthetic_monthly):
        results = run_statsforecast(synthetic_monthly, horizon=6, frequency="M")
        for r in results:
            for i in range(6):
                assert r.lo_90[i] <= r.lo_80[i] <= r.hi_80[i] <= r.hi_90[i]

    def test_daily_frequency(self):
        np.random.seed(0)
        t = np.arange(100)
        values = (50 + 10 * np.sin(2 * np.pi * t / 7) + np.random.normal(0, 2, 100)).tolist()
        results = run_statsforecast(values, horizon=7, frequency="D")
        assert len(results) == 3
        for r in results:
            assert len(r.point_forecast) == 7

    def test_hourly_frequency(self):
        np.random.seed(0)
        values = (np.sin(np.arange(200) * 2 * np.pi / 24) * 10 + 50).tolist()
        results = run_statsforecast(values, horizon=24, frequency="H")
        assert len(results) == 3


class TestRunAllModels:
    def test_returns_five_models(self, synthetic_monthly):
        results = run_all_models(synthetic_monthly, horizon=12, frequency="M")
        assert len(results) == 5
        names = {r.model_name for r in results}
        assert "Chronos-2" in names
        assert "TimesFM" in names
        assert "AutoETS" in names
