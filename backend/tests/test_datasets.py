import io

import pandas as pd
import pytest


@pytest.mark.asyncio
async def test_list_datasets(client):
    response = await client.get("/api/datasets")
    assert response.status_code == 200
    datasets = response.json()
    assert len(datasets) == 16, f"Expected 16 datasets, got {len(datasets)}"
    names = {d["name"] for d in datasets}
    # Original 10
    assert "airline_passengers" in names
    assert "sunspots" in names
    assert "energy_demand" in names
    assert "us_retail_sales" in names
    assert "electricity_price_de" in names
    assert "us_unemployment" in names
    assert "aus_beer_production" in names
    assert "daily_temp_melbourne" in names
    assert "hospital_admissions" in names
    assert "web_traffic" in names
    # Phase 4A additions (11-16)
    assert "bike_rentals" in names
    assert "supermarket_weekly" in names
    assert "energy_demand_temp" in names
    assert "us_cpi" in names
    assert "gold_price_usd" in names
    assert "co2_atmospheric" in names
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


class TestCovariateDatasets:
    """Tests for Phase 4A covariate datasets (11-13)."""

    def test_bike_rentals_has_covariate_columns(self):
        from laplace.services.parser import load_preloaded
        df = load_preloaded("bike_rentals")
        assert "temperature" in df.columns
        assert "humidity" in df.columns
        assert "windspeed" in df.columns
        assert len(df) == 730

    def test_supermarket_weekly_has_covariate_columns(self):
        from laplace.services.parser import load_preloaded
        df = load_preloaded("supermarket_weekly")
        assert "promo_flag" in df.columns
        assert "competitor_price" in df.columns
        assert len(df) == 200

    def test_energy_demand_temp_has_covariate_columns(self):
        from laplace.services.parser import load_preloaded
        df = load_preloaded("energy_demand_temp")
        assert "temperature_c" in df.columns
        assert "humidity_pct" in df.columns
        assert len(df) == 1000

    def test_covariate_datasets_have_3_plus_numeric_columns(self):
        from laplace.services.parser import load_preloaded
        for name in ("bike_rentals", "supermarket_weekly", "energy_demand_temp"):
            df = load_preloaded(name)
            numeric_cols = df.select_dtypes(include="number").columns.tolist()
            assert len(numeric_cols) >= 3, (
                f"'{name}' needs ≥3 numeric cols for covariate UI, got: {numeric_cols}"
            )

    def test_new_univariate_datasets_load_and_parse(self):
        from laplace.services.parser import load_preloaded, detect_columns, validate_and_prepare, PRELOADED_DATASETS
        for name in ("us_cpi", "gold_price_usd", "co2_atmospheric"):
            df = load_preloaded(name)
            detection = detect_columns(df)
            meta = PRELOADED_DATASETS[name]
            result = validate_and_prepare(
                df, detection.datetime_col, detection.target_col,
                frequency=meta["frequency"], name=name,
            )
            assert result.n_points >= 100, f"'{name}' should have ≥100 points"
            assert result.covariates is None, f"'{name}' is univariate, should have no covariates"

    def test_new_domains_present(self):
        from laplace.services.parser import PRELOADED_DATASETS
        domains = {meta["domain"] for meta in PRELOADED_DATASETS.values()}
        assert "finance" in domains
        assert "environment" in domains
