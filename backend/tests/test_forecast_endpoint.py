import numpy as np
import pytest


@pytest.mark.asyncio
async def test_forecast_endpoint(client):
    np.random.seed(42)
    t = np.arange(100)
    values = (100 + 2 * t + 20 * np.sin(2 * np.pi * t / 12)).tolist()

    response = await client.post(
        "/api/forecast",
        json={"values": values, "frequency": "M", "horizon": 12},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["horizon"] == 12
    assert len(data["forecasts"]) == 5
    for f in data["forecasts"]:
        assert len(f["point_forecast"]) == 12


@pytest.mark.asyncio
async def test_forecast_single_model(client):
    values = list(range(50, 150))

    response = await client.post(
        "/api/forecast",
        json={"values": values, "frequency": "M", "model_name": "Chronos-2"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["forecasts"]) == 1
    assert data["forecasts"][0]["model_name"] == "Chronos-2"


@pytest.mark.asyncio
async def test_forecast_too_few_points(client):
    response = await client.post(
        "/api/forecast",
        json={"values": [1, 2, 3], "frequency": "M"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_forecast_horizon_too_large(client):
    values = list(range(30))
    response = await client.post(
        "/api/forecast",
        json={"values": values, "frequency": "M", "horizon": 25},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_backtest_endpoint(client):
    np.random.seed(42)
    t = np.arange(100)
    values = (100 + 2 * t + 20 * np.sin(2 * np.pi * t / 12)).tolist()

    response = await client.post(
        "/api/backtest",
        json={"values": values, "frequency": "M", "horizon": 12, "n_splits": 2},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["n_splits"] == 2
    assert len(data["folds"]) == 2
    assert data["winner"] in data["aggregate_metrics"]
    assert data["selection_metric"] == "smape"

    for fold in data["folds"]:
        assert len(fold["actual"]) == 12
        assert len(fold["forecasts"]) == 5


@pytest.mark.asyncio
async def test_backtest_too_few_points(client):
    response = await client.post(
        "/api/backtest",
        json={"values": [1, 2, 3, 4, 5], "frequency": "M"},
    )
    assert response.status_code == 422
