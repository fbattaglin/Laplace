import pytest

from laplace.models.schemas import PreprocessingConfig
from laplace.services.preprocessing import (
    apply_preprocessing,
    difference,
    remove_outliers,
    smooth,
)


# ── Unit tests ─────────────────────────────────────────────────────────────────

class TestRemoveOutliers:
    def test_no_outliers_returns_original(self):
        # Evenly spaced series — no outliers under IQR 1.5x rule
        values = [float(i) for i in range(1, 21)]
        result, step = remove_outliers(values, method="iqr")
        assert step.points_affected == 0
        assert result == values

    def test_detects_iqr_outlier(self):
        values = [10.0] * 15 + [1000.0]  # clear outlier
        result, step = remove_outliers(values, method="iqr", replacement="interpolate")
        assert step.points_affected == 1
        assert result[-1] < 100.0  # outlier replaced

    def test_detects_zscore_outlier(self):
        values = [10.0] * 15 + [500.0]
        result, step = remove_outliers(values, method="zscore", replacement="interpolate")
        assert step.points_affected >= 1

    def test_winsorize_replacement(self):
        values = [10.0] * 14 + [1000.0, 9.5]
        result, step = remove_outliers(values, method="iqr", replacement="winsorize")
        assert step.points_affected >= 1
        assert max(result) < 1000.0  # winsorized

    def test_length_preserved(self):
        values = list(range(1, 21))
        values[10] = 9999
        result, _ = remove_outliers(values)
        assert len(result) == len(values)


class TestSmooth:
    def test_sma_output_length_preserved(self):
        values = [float(i) for i in range(20)]
        result, step = smooth(values, method="sma")
        assert len(result) == len(values)
        assert step.operation == "smooth"

    def test_ema_output_length_preserved(self):
        values = [float(i) for i in range(20)]
        result, step = smooth(values, method="ema", window=3)
        assert len(result) == len(values)

    def test_smoothing_reduces_noise(self):
        import random
        random.seed(42)
        noisy = [10.0 + random.gauss(0, 5) for _ in range(50)]
        smoothed, _ = smooth(noisy, method="sma", window=5)
        variance_noisy = sum((x - 10.0) ** 2 for x in noisy) / len(noisy)
        variance_smooth = sum((x - 10.0) ** 2 for x in smoothed) / len(smoothed)
        assert variance_smooth < variance_noisy

    def test_auto_window_selection(self):
        values = [float(i) for i in range(30)]
        result, step = smooth(values)
        assert len(result) == 30
        assert "window=" in step.description or "span=" in step.description


class TestDifference:
    def test_first_order_reduces_length_by_one(self):
        values = [1.0, 3.0, 6.0, 10.0, 15.0]
        result, step = difference(values, order=1)
        assert len(result) == 4
        assert result == pytest.approx([2.0, 3.0, 4.0, 5.0])
        assert step.points_affected == 1

    def test_second_order_reduces_length_by_two(self):
        values = [1.0, 3.0, 6.0, 10.0, 15.0]
        result, step = difference(values, order=2)
        assert len(result) == 3
        assert step.points_affected == 2

    def test_removes_linear_trend(self):
        values = [float(i) for i in range(20)]
        result, _ = difference(values, order=1)
        # first diff of a perfect ramp is all 1s
        assert all(abs(v - 1.0) < 1e-9 for v in result)


class TestApplyPreprocessing:
    def _dates(self, n: int) -> list[str]:
        import pandas as pd
        return [str(d.date()) for d in pd.date_range("2020-01-01", periods=n, freq="D")]

    def test_no_ops_returns_original(self):
        values = [float(i) for i in range(20)]
        dates = self._dates(20)
        config = PreprocessingConfig()
        result = apply_preprocessing(values, dates, config)
        assert result.values == values
        assert result.original_values == values
        assert result.n_outliers_removed == 0
        assert result.n_points_removed == 0

    def test_outlier_removal_step_logged(self):
        values = [10.0] * 19 + [9999.0]
        dates = self._dates(20)
        config = PreprocessingConfig(remove_outliers=True)
        result = apply_preprocessing(values, dates, config)
        assert any(s.operation == "remove_outliers" for s in result.log)
        assert result.n_outliers_removed >= 1

    def test_smooth_step_logged(self):
        values = [float(i) for i in range(20)]
        dates = self._dates(20)
        config = PreprocessingConfig(smooth=True, smooth_method="sma")
        result = apply_preprocessing(values, dates, config)
        assert any(s.operation == "smooth" for s in result.log)

    def test_difference_trims_dates(self):
        values = [float(i) for i in range(20)]
        dates = self._dates(20)
        config = PreprocessingConfig(difference=True, difference_order=1)
        result = apply_preprocessing(values, dates, config)
        assert len(result.values) == 19
        assert len(result.dates) == 19
        assert result.n_points_removed == 1

    def test_original_values_preserved(self):
        values = [10.0] * 19 + [9999.0]
        dates = self._dates(20)
        config = PreprocessingConfig(remove_outliers=True)
        result = apply_preprocessing(values, dates, config)
        assert result.original_values[-1] == 9999.0
        assert result.values[-1] < 100.0

    def test_combined_operations(self):
        values = [float(i) for i in range(20)]
        values[10] = 9999.0
        dates = self._dates(20)
        config = PreprocessingConfig(remove_outliers=True, smooth=True, difference=True)
        result = apply_preprocessing(values, dates, config)
        assert len(result.log) == 3
        assert len(result.values) == 19  # 1 removed by differencing


# ── API endpoint tests ─────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_preprocess_endpoint_happy_path(client):
    payload = {
        "values": [float(i) for i in range(30)],
        "dates": [f"2020-01-{d:02d}" for d in range(1, 31)],
        "config": {
            "remove_outliers": True,
            "smooth": False,
            "difference": False,
        },
    }
    resp = await client.post("/api/preprocessing", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "values" in data
    assert "log" in data
    assert len(data["values"]) == 30


@pytest.mark.asyncio
async def test_preprocess_endpoint_too_few_points(client):
    payload = {
        "values": [1.0, 2.0, 3.0],
        "dates": ["2020-01-01", "2020-02-01", "2020-03-01"],
        "config": {"remove_outliers": True},
    }
    resp = await client.post("/api/preprocessing", json=payload)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_preprocess_endpoint_mismatched_lengths(client):
    payload = {
        "values": list(range(20)),
        "dates": ["2020-01-01"] * 15,
        "config": {},
    }
    resp = await client.post("/api/preprocessing", json=payload)
    assert resp.status_code == 422
