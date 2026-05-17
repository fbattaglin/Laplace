import io

import pandas as pd
import pytest


@pytest.mark.asyncio
async def test_list_datasets(client):
    response = await client.get("/api/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) == 10
    names = {d["name"] for d in datasets}
    assert names == {
        "airline_passengers", "sunspots", "energy_demand",
        "us_retail_sales", "electricity_price_de", "us_unemployment",
        "aus_beer_production", "daily_temp_melbourne", "hospital_admissions",
        "web_traffic",
    }
    for d in datasets:
        assert "frequency" in d
        assert "n_rows" in d
        assert d["n_rows"] > 0


@pytest.mark.asyncio
async def test_load_airline_passengers(client):
    response = await client.get("/api/datasets/airline_passengers")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "airline_passengers"
    assert data["frequency"] == "M"
    assert data["n_points"] == 144
    assert len(data["dates"]) == 144
    assert len(data["values"]) == 144


@pytest.mark.asyncio
async def test_load_energy_demand(client):
    response = await client.get("/api/datasets/energy_demand")
    assert response.status_code == 200
    data = response.json()
    assert data["frequency"] == "H"
    assert data["n_points"] == 1000


@pytest.mark.asyncio
async def test_load_unknown_dataset(client):
    response = await client.get("/api/datasets/nonexistent")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upload_valid_csv(client):
    csv_content = "date,value\n2024-01-01,10\n2024-01-02,20\n2024-01-03,30\n"
    response = await client.post(
        "/api/datasets/upload",
        files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["columns"] == ["date", "value"]
    assert data["n_rows"] == 3
    assert data["detected"]["datetime_col"] == "date"
    assert data["detected"]["target_col"] == "value"
    assert data["detected"]["confidence"] > 0.5


@pytest.mark.asyncio
async def test_upload_invalid_format(client):
    response = await client.post(
        "/api/datasets/upload",
        files={"file": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_empty_csv(client):
    csv_content = "date,value\n"
    response = await client.post(
        "/api/datasets/upload",
        files={"file": ("empty.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_confirm_preloaded(client):
    response = await client.post(
        "/api/datasets/confirm",
        json={
            "source": "preloaded",
            "dataset_name": "airline_passengers",
            "datetime_col": "date",
            "target_col": "passengers",
            "frequency": "M",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["n_points"] == 144
    assert data["frequency"] == "M"


class TestDetectColumns:
    def test_standard_datetime_numeric(self):
        from laplace.services.parser import detect_columns

        df = pd.DataFrame({
            "date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "sales": [100, 200, 300],
        })
        result = detect_columns(df)
        assert result.datetime_col == "date"
        assert result.target_col == "sales"

    def test_multiple_numeric_picks_first(self):
        from laplace.services.parser import detect_columns

        df = pd.DataFrame({
            "timestamp": ["2024-01-01", "2024-01-02"],
            "price": [10.5, 11.0],
            "volume": [1000, 2000],
        })
        result = detect_columns(df)
        assert result.datetime_col == "timestamp"
        assert result.target_col == "price"

    def test_no_datetime_column(self):
        from laplace.services.parser import detect_columns

        df = pd.DataFrame({"x": [1, 2, 3], "y": [4, 5, 6]})
        result = detect_columns(df)
        assert result.confidence < 0.5

    def test_various_date_formats(self):
        from laplace.services.parser import detect_columns

        df = pd.DataFrame({
            "dt": ["01/15/2024", "02/15/2024", "03/15/2024"],
            "val": [1.0, 2.0, 3.0],
        })
        result = detect_columns(df)
        assert result.datetime_col == "dt"
        assert result.confidence > 0.5

    def test_iso_format(self):
        from laplace.services.parser import detect_columns

        df = pd.DataFrame({
            "time": ["2024-01-01T00:00:00", "2024-01-01T01:00:00"],
            "measurement": [42.0, 43.5],
        })
        result = detect_columns(df)
        assert result.datetime_col == "time"
        assert result.target_col == "measurement"


class TestValidateAndPrepare:
    def test_interpolates_small_gaps(self):
        from laplace.services.parser import validate_and_prepare

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=20, freq="D").strftime("%Y-%m-%d"),
            "value": [float(i) if i % 5 != 0 else None for i in range(20)],
        })
        # gaps of 1 should be interpolated
        result = validate_and_prepare(df, "date", "value", name="test")
        assert result.n_points == 20
        assert None not in result.values

    def test_rejects_large_gaps(self):
        from laplace.services.parser import validate_and_prepare

        values = [1.0] * 5 + [None] * 5 + [1.0] * 5
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=15, freq="D").strftime("%Y-%m-%d"),
            "value": values,
        })
        with pytest.raises(ValueError, match="gaps"):
            validate_and_prepare(df, "date", "value", name="test")

    def test_rejects_too_few_points(self):
        from laplace.services.parser import validate_and_prepare

        df = pd.DataFrame({
            "date": ["2024-01-01", "2024-01-02", "2024-01-03"],
            "value": [1.0, 2.0, 3.0],
        })
        with pytest.raises(ValueError, match="Not enough"):
            validate_and_prepare(df, "date", "value", name="test")

    def test_infers_monthly_frequency(self):
        from laplace.services.parser import validate_and_prepare

        df = pd.DataFrame({
            "date": pd.date_range("2020-01-01", periods=36, freq="MS").strftime("%Y-%m-%d"),
            "value": list(range(36)),
        })
        result = validate_and_prepare(df, "date", "value", name="test")
        assert result.frequency == "M"
