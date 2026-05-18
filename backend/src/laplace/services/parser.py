from io import BytesIO
from pathlib import Path

import numpy as np
import pandas as pd

from laplace.config import settings
from laplace.models.schemas import (
    ColumnDetection,
    DatasetMeta,
    Frequency,
    TimeSeriesData,
    UploadResponse,
)

PRELOADED_DATASETS: dict[str, dict] = {
    # ── Classic / Research ─────────────────────────────────────────────────────
    "airline_passengers": {
        "file": "airline_passengers.csv",
        "description": "Monthly totals of international airline passengers (1949-1960)",
        "frequency": "M",
        "domain": "transport",
    },
    "sunspots": {
        "file": "sunspots.csv",
        "description": "Monthly mean sunspot numbers (1749-1983)",
        "frequency": "M",
        "domain": "science",
    },
    # ── Energy ────────────────────────────────────────────────────────────────
    "energy_demand": {
        "file": "energy_demand.csv",
        "description": "Hourly energy demand sample (synthetic, 1000 points)",
        "frequency": "H",
        "domain": "energy",
    },
    "electricity_price_de": {
        "file": "electricity_price_de.csv",
        "description": "Daily German electricity spot price EUR/MWh (2021-2023)",
        "frequency": "D",
        "domain": "energy",
    },
    "energy_demand_temp": {
        "file": "energy_demand_temp.csv",
        "description": "Daily energy demand with temperature & humidity covariates (2021-2023)",
        "frequency": "D",
        "domain": "energy",
        "covariate_cols": ["temperature_c", "humidity_pct"],
    },
    # ── Economics ─────────────────────────────────────────────────────────────
    "us_unemployment": {
        "file": "us_unemployment.csv",
        "description": "Monthly US unemployment rate (2005-2024)",
        "frequency": "M",
        "domain": "economics",
    },
    "us_cpi": {
        "file": "us_cpi.csv",
        "description": "Synthetic monthly US CPI tracking observed inflation (1999-2024)",
        "frequency": "M",
        "domain": "economics",
    },
    # ── Retail / Consumer ─────────────────────────────────────────────────────
    "us_retail_sales": {
        "file": "us_retail_sales.csv",
        "description": "Monthly US retail sales in billions USD (2000-2024)",
        "frequency": "M",
        "domain": "retail",
    },
    "supermarket_weekly": {
        "file": "supermarket_weekly.csv",
        "description": "Weekly supermarket sales with promo & competitor price covariates",
        "frequency": "W",
        "domain": "retail",
        "covariate_cols": ["promo_flag", "competitor_price"],
    },
    # ── Transport ─────────────────────────────────────────────────────────────
    "bike_rentals": {
        "file": "bike_rentals.csv",
        "description": "Daily bike rentals with temperature, humidity & wind covariates (2022-2023)",
        "frequency": "D",
        "domain": "transport",
        "covariate_cols": ["temperature", "humidity", "windspeed"],
    },
    # ── Manufacturing / Industry ──────────────────────────────────────────────
    "aus_beer_production": {
        "file": "aus_beer_production.csv",
        "description": "Quarterly Australian beer production in megalitres (1992-2024)",
        "frequency": "Q",
        "domain": "manufacturing",
    },
    # ── Climate / Environment ─────────────────────────────────────────────────
    "daily_temp_melbourne": {
        "file": "daily_temp_melbourne.csv",
        "description": "Daily minimum temperature in Melbourne, °C (2014-2023)",
        "frequency": "D",
        "domain": "climate",
    },
    "co2_atmospheric": {
        "file": "co2_atmospheric.csv",
        "description": "Synthetic monthly atmospheric CO2 ppm (Mauna Loa-style, 1959-2024)",
        "frequency": "M",
        "domain": "environment",
    },
    # ── Healthcare ────────────────────────────────────────────────────────────
    "hospital_admissions": {
        "file": "hospital_admissions.csv",
        "description": "Weekly hospital emergency admissions (2019-2024)",
        "frequency": "W",
        "domain": "healthcare",
    },
    # ── Finance ───────────────────────────────────────────────────────────────
    "gold_price_usd": {
        "file": "gold_price_usd.csv",
        "description": "Synthetic monthly gold price USD/oz tracking historical dynamics (1989-2024)",
        "frequency": "M",
        "domain": "finance",
    },
    # ── Digital ───────────────────────────────────────────────────────────────
    "web_traffic": {
        "file": "web_traffic.csv",
        "description": "Daily Wikipedia article pageviews (2022-2024)",
        "frequency": "D",
        "domain": "digital",
    },
}


def list_preloaded() -> list[DatasetMeta]:
    results = []
    for name, meta in PRELOADED_DATASETS.items():
        filepath = settings.data_dir / meta["file"]
        if filepath.exists():
            df = pd.read_csv(filepath)
            results.append(
                DatasetMeta(
                    name=name,
                    description=meta["description"],
                    frequency=meta["frequency"],
                    n_rows=len(df),
                    columns=list(df.columns),
                    domain=meta.get("domain"),
                    covariate_cols=meta.get("covariate_cols"),
                )
            )
    return results


def load_preloaded(name: str) -> pd.DataFrame:
    if name not in PRELOADED_DATASETS:
        raise ValueError(f"Unknown dataset: {name}")
    filepath = settings.data_dir / PRELOADED_DATASETS[name]["file"]
    if not filepath.exists():
        raise FileNotFoundError(f"Dataset file not found: {filepath}")
    return pd.read_csv(filepath)


def parse_upload(content: bytes, filename: str) -> pd.DataFrame:
    suffix = Path(filename).suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(BytesIO(content))
    elif suffix in (".xlsx", ".xls"):
        return pd.read_excel(BytesIO(content), engine="openpyxl")
    else:
        raise ValueError(f"Unsupported file format: {suffix}. Use CSV or XLSX.")


def _is_datetime_parseable(series: pd.Series, sample_size: int = 50) -> float:
    sample = series.dropna().head(sample_size).astype(str)
    if len(sample) == 0:
        return 0.0
    try:
        parsed = pd.to_datetime(sample, errors="coerce")
        return float(parsed.notna().sum() / len(sample))
    except Exception:
        return 0.0


def _is_numeric(series: pd.Series) -> bool:
    return pd.api.types.is_numeric_dtype(series)


def detect_columns(df: pd.DataFrame) -> ColumnDetection:
    datetime_col = None
    datetime_confidence = 0.0

    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            datetime_col = col
            datetime_confidence = 1.0
            break
        score = _is_datetime_parseable(df[col])
        if score > datetime_confidence:
            datetime_confidence = score
            datetime_col = col

    target_col = None
    numeric_cols = [c for c in df.columns if _is_numeric(df[c]) and c != datetime_col]
    if numeric_cols:
        target_col = numeric_cols[0]

    confidence = min(datetime_confidence, 1.0 if target_col else 0.0)
    return ColumnDetection(
        datetime_col=datetime_col,
        target_col=target_col,
        confidence=confidence,
    )


def build_upload_response(df: pd.DataFrame, n_preview: int = 20) -> UploadResponse:
    preview = df.head(n_preview).replace({np.nan: None}).to_dict(orient="records")
    detection = detect_columns(df)
    return UploadResponse(
        columns=list(df.columns),
        dtypes={col: str(dtype) for col, dtype in df.dtypes.items()},
        preview_rows=preview,
        detected=detection,
        n_rows=len(df),
    )


def _infer_frequency(dt_index: pd.DatetimeIndex) -> Frequency:
    freq = pd.infer_freq(dt_index)
    if freq is None:
        median_diff = dt_index.to_series().diff().median()
        if median_diff <= pd.Timedelta(hours=2):
            return "H"
        elif median_diff <= pd.Timedelta(days=2):
            return "D"
        elif median_diff <= pd.Timedelta(weeks=2):
            return "W"
        elif median_diff <= pd.Timedelta(days=100):
            return "M"
        elif median_diff <= pd.Timedelta(days=200):
            return "Q"
        else:
            return "Y"

    freq_upper = freq.upper()
    if "H" in freq_upper or "T" in freq_upper:
        return "H"
    elif "D" in freq_upper or "B" in freq_upper:
        return "D"
    elif "W" in freq_upper:
        return "W"
    elif "M" in freq_upper or "MS" in freq_upper:
        return "M"
    elif "Q" in freq_upper or "QS" in freq_upper:
        return "Q"
    else:
        return "Y"


def validate_and_prepare(
    df: pd.DataFrame,
    datetime_col: str,
    target_col: str,
    frequency: Frequency | None = None,
    name: str = "uploaded",
    covariate_cols: list[str] | None = None,
) -> TimeSeriesData:
    if datetime_col not in df.columns:
        raise ValueError(f"Column '{datetime_col}' not found in data")
    if target_col not in df.columns:
        raise ValueError(f"Column '{target_col}' not found in data")

    # Resolve valid covariate columns (must exist, not be datetime or target)
    valid_cov_cols: list[str] = []
    if covariate_cols:
        for col in covariate_cols:
            if col in df.columns and col not in (datetime_col, target_col):
                valid_cov_cols.append(col)

    cols_to_use = [datetime_col, target_col] + valid_cov_cols
    work = df[cols_to_use].copy()
    work[datetime_col] = pd.to_datetime(work[datetime_col], errors="coerce")

    n_invalid_dates = work[datetime_col].isna().sum()
    if n_invalid_dates > len(work) * 0.1:
        raise ValueError(
            f"More than 10% of dates could not be parsed ({n_invalid_dates}/{len(work)} invalid)"
        )

    work = work.dropna(subset=[datetime_col])
    work = work.sort_values(datetime_col).reset_index(drop=True)

    work[target_col] = pd.to_numeric(work[target_col], errors="coerce")

    # Coerce and interpolate covariates (aligned with the validated date index)
    for col in valid_cov_cols:
        work[col] = pd.to_numeric(work[col], errors="coerce")
        work[col] = work[col].interpolate(method="linear").bfill().ffill()

    max_consecutive_gap = 3
    missing_mask = work[target_col].isna()
    if missing_mask.any():
        groups = missing_mask.ne(missing_mask.shift()).cumsum()
        max_gap = missing_mask.groupby(groups).sum().max()
        if max_gap > max_consecutive_gap:
            raise ValueError(
                f"Data has gaps of {int(max_gap)} consecutive missing values "
                f"(max allowed: {max_consecutive_gap}). Please clean your data first."
            )
        work[target_col] = (
            work[target_col].interpolate(method="linear").bfill().ffill()
        )

    work = work.dropna(subset=[target_col])

    if len(work) < 10:
        raise ValueError("Not enough valid data points (minimum 10 required)")

    dt_index = pd.DatetimeIndex(work[datetime_col])
    detected_freq = frequency or _infer_frequency(dt_index)

    dates = work[datetime_col].dt.strftime("%Y-%m-%dT%H:%M:%S").tolist()
    values = work[target_col].tolist()

    covariates: dict[str, list[float]] | None = None
    if valid_cov_cols:
        covariates = {col: work[col].tolist() for col in valid_cov_cols}

    return TimeSeriesData(
        dates=dates,
        values=values,
        frequency=detected_freq,
        name=name,
        n_points=len(values),
        covariates=covariates,
    )
