import numpy as np
import pytest

from laplace.services.diagnostics import compute_acf_pacf, compute_forecastability, compute_stl


class TestSTL:
    def test_airline_monthly(self):
        np.random.seed(0)
        t = np.arange(144)
        trend = 100 + 2 * t
        seasonal = 30 * np.sin(2 * np.pi * t / 12)
        noise = np.random.normal(0, 5, 144)
        values = (trend + seasonal + noise).tolist()

        result = compute_stl(values, "M")
        assert len(result["trend"]) == 144
        assert len(result["seasonal"]) == 144
        assert len(result["residual"]) == 144
        # Trend should be roughly increasing
        assert result["trend"][-1] > result["trend"][0]

    def test_short_series_no_crash(self):
        values = list(range(24))
        result = compute_stl(values, "M")
        assert len(result["trend"]) == 24

    def test_yearly_no_seasonality(self):
        values = list(range(20))
        result = compute_stl(values, "Y")
        assert len(result["trend"]) == 20
        # Seasonal should be zeros for yearly (period=1)
        assert all(s == 0.0 for s in result["seasonal"])


class TestACFPACF:
    def test_ar1_process(self):
        np.random.seed(42)
        n = 200
        values = [0.0]
        for _ in range(n - 1):
            values.append(0.8 * values[-1] + np.random.normal(0, 1))

        result = compute_acf_pacf(values)
        # ACF should decay for AR(1)
        assert abs(result["acf_values"][1]) > abs(result["acf_values"][10])
        # PACF should be significant at lag 1, near zero after
        assert abs(result["pacf_values"][1]) > 0.5
        assert abs(result["pacf_values"][5]) < 0.2

    def test_lag_count(self):
        values = list(range(100))
        result = compute_acf_pacf(values, n_lags=20)
        assert len(result["acf_values"]) == 21  # includes lag 0
        assert len(result["lags"]) == 21


class TestForecastability:
    def test_pure_sine_high_score(self):
        t = np.arange(200)
        values = (50 * np.sin(2 * np.pi * t / 12)).tolist()
        result = compute_forecastability(values, "M")
        assert result["total_score"] > 75

    def test_white_noise_low_score(self):
        np.random.seed(99)
        values = np.random.normal(0, 1, 200).tolist()
        result = compute_forecastability(values, "M")
        assert result["total_score"] < 35

    def test_airline_moderate_high(self):
        np.random.seed(0)
        t = np.arange(144)
        trend = 100 + 2 * t
        seasonal = 30 * np.sin(2 * np.pi * t / 12)
        noise = np.random.normal(0, 10, 144)
        values = (trend + seasonal + noise).tolist()
        result = compute_forecastability(values, "M")
        assert 50 < result["total_score"] < 95

    def test_returns_5_dimensions(self):
        values = list(range(100))
        result = compute_forecastability(values, "M")
        assert len(result["dimensions"]) == 5
        assert all("name" in d for d in result["dimensions"])
        assert all("score" in d for d in result["dimensions"])

    def test_interpretation_text(self):
        np.random.seed(0)
        t = np.arange(200)
        values = (100 * np.sin(2 * np.pi * t / 12)).tolist()
        result = compute_forecastability(values, "M")
        assert "High" in result["interpretation"]

    def test_hourly_frequency(self):
        np.random.seed(0)
        t = np.arange(500)
        values = (20 * np.sin(2 * np.pi * t / 24) + np.random.normal(0, 2, 500)).tolist()
        result = compute_forecastability(values, "H")
        assert result["total_score"] > 50


@pytest.mark.asyncio
async def test_diagnostics_endpoint(client):
    # First load airline data
    response = await client.get("/api/datasets/airline_passengers")
    assert response.status_code == 200
    ts_data = response.json()

    # Then run diagnostics
    response = await client.post("/api/diagnostics", json=ts_data)
    assert response.status_code == 200
    data = response.json()

    assert "stl" in data
    assert "acf_pacf" in data
    assert "forecastability" in data
    assert len(data["stl"]["trend"]) == 144
    assert len(data["acf_pacf"]["acf_values"]) > 10
    assert 0 <= data["forecastability"]["total_score"] <= 100


@pytest.mark.asyncio
async def test_diagnostics_too_few_points(client):
    response = await client.post(
        "/api/diagnostics",
        json={
            "dates": ["2024-01-01"] * 5,
            "values": [1, 2, 3, 4, 5],
            "frequency": "D",
            "name": "tiny",
        },
    )
    assert response.status_code == 422
