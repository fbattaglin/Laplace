"""
Generate 6 new preloaded datasets (datasets 11-16) and 5 sample_datasets/ test files.

All datasets use fixed numpy seeds for full reproducibility.
Run from the repo root:
    uv run python backend/scripts/generate_datasets.py
"""

from pathlib import Path

import numpy as np
import pandas as pd

PRELOADED_DIR = Path(__file__).parents[1] / "src" / "laplace" / "data" / "preloaded"
SAMPLE_DIR = Path(__file__).parents[2] / "sample_datasets"

PRELOADED_DIR.mkdir(parents=True, exist_ok=True)
SAMPLE_DIR.mkdir(parents=True, exist_ok=True)


# ─── Preloaded dataset generators ─────────────────────────────────────────────

def gen_bike_rentals():
    """Daily bike rentals with covariates: temperature, humidity, windspeed (730 days)."""
    rng = np.random.default_rng(101)
    n = 730
    dates = pd.date_range("2022-01-01", periods=n, freq="D")

    # Seasonal temperature: cold Jan-Feb, warm Jul-Aug
    day_of_year = np.arange(n) % 365
    temp_baseline = 8 + 14 * np.sin((day_of_year - 80) * 2 * np.pi / 365)
    temperature = temp_baseline + rng.standard_normal(n) * 2.5

    humidity = np.clip(60 + 20 * np.sin((day_of_year - 30) * 2 * np.pi / 365) + rng.standard_normal(n) * 8, 20, 100)
    windspeed = np.abs(15 + rng.standard_normal(n) * 6)

    # Rentals depend on temperature and inversely on wind, with weekly pattern
    weekday = np.array([d.weekday() for d in dates])
    weekend_boost = np.where(weekday >= 5, 1.3, 1.0)
    count = (
        1500
        + 80 * temperature
        - 30 * windspeed
        - 10 * (humidity - 60)
        + rng.standard_normal(n) * 200
    ) * weekend_boost
    count = np.maximum(count, 50).round().astype(int)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "count": count,
        "temperature": np.round(temperature, 1),
        "humidity": np.round(humidity, 1),
        "windspeed": np.round(windspeed, 1),
    })
    df.to_csv(PRELOADED_DIR / "bike_rentals.csv", index=False)
    print(f"✓ bike_rentals.csv ({len(df)} rows)")


def gen_supermarket_weekly():
    """Weekly supermarket sales with covariates: promo_flag, competitor_price (200 weeks)."""
    rng = np.random.default_rng(202)
    n = 200
    dates = pd.date_range("2020-01-06", periods=n, freq="W-MON")

    week = np.arange(n)
    # Underlying trend + seasonality
    trend = 50000 + week * 80
    season = 8000 * np.sin(week * 2 * np.pi / 52 - np.pi / 2)
    noise = rng.standard_normal(n) * 2000

    # Promo: ~15% of weeks are promotional
    promo_flag = (rng.random(n) < 0.15).astype(int)
    promo_boost = promo_flag * rng.uniform(5000, 15000, n)

    # Competitor price varies around 2.5 ±0.3
    competitor_price = np.clip(2.5 + rng.standard_normal(n) * 0.15, 1.8, 3.5)

    sales = (trend + season + noise + promo_boost).round().astype(int)
    sales = np.maximum(sales, 10000)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "sales": sales,
        "promo_flag": promo_flag,
        "competitor_price": np.round(competitor_price, 2),
    })
    df.to_csv(PRELOADED_DIR / "supermarket_weekly.csv", index=False)
    print(f"✓ supermarket_weekly.csv ({len(df)} rows)")


def gen_energy_demand_temp():
    """Daily energy demand with covariates: temperature_c, humidity_pct (1000 days)."""
    rng = np.random.default_rng(303)
    n = 1000
    dates = pd.date_range("2021-01-01", periods=n, freq="D")

    day_of_year = np.arange(n) % 365
    temperature_c = 10 + 12 * np.sin((day_of_year - 15) * 2 * np.pi / 365 + np.pi) + rng.standard_normal(n) * 2
    humidity_pct = np.clip(55 + 20 * np.sin(day_of_year * 2 * np.pi / 365) + rng.standard_normal(n) * 6, 20, 100)

    # Demand peaks in cold (heating) and hot (cooling) months
    heat_cool = (temperature_c - 18) ** 2 / 10
    demand = (
        250 + 25 * heat_cool + 0.3 * humidity_pct + rng.standard_normal(n) * 15
    )
    demand = np.maximum(demand, 50)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "demand_gwh": np.round(demand, 2),
        "temperature_c": np.round(temperature_c, 1),
        "humidity_pct": np.round(humidity_pct, 1),
    })
    df.to_csv(PRELOADED_DIR / "energy_demand_temp.csv", index=False)
    print(f"✓ energy_demand_temp.csv ({len(df)} rows)")


def gen_us_cpi():
    """Synthetic monthly US CPI (Consumer Price Index) — 300 months from 1999."""
    rng = np.random.default_rng(404)
    n = 300
    dates = pd.date_range("1999-01-01", periods=n, freq="MS")

    # CPI starts around 165 in 1999 and climbs to ~330 by 2024
    monthly_inflation = 0.002 + rng.standard_normal(n) * 0.001
    # Post-2021 inflation shock (months 264+)
    monthly_inflation[264:] += 0.005
    monthly_inflation = np.clip(monthly_inflation, -0.01, 0.025)

    cpi = [165.0]
    for r in monthly_inflation[1:]:
        cpi.append(cpi[-1] * (1 + r))

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "cpi": np.round(cpi, 2),
    })
    df.to_csv(PRELOADED_DIR / "us_cpi.csv", index=False)
    print(f"✓ us_cpi.csv ({len(df)} rows)")


def gen_gold_price():
    """Synthetic monthly gold price USD/oz — 420 months from 1989."""
    rng = np.random.default_rng(505)
    n = 420
    dates = pd.date_range("1989-01-01", periods=n, freq="MS")

    # Log-normal random walk to mimic gold price dynamics
    log_returns = rng.standard_normal(n) * 0.035 + 0.003
    # Flight-to-safety bumps: 2001 (months 144), 2008 (months 228), 2020 (months 372)
    log_returns[144:150] += 0.02
    log_returns[228:240] += 0.04
    log_returns[372:380] += 0.03

    price = [400.0]
    for r in log_returns[1:]:
        price.append(price[-1] * np.exp(r))

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "price_usd": np.round(price, 2),
    })
    df.to_csv(PRELOADED_DIR / "gold_price_usd.csv", index=False)
    print(f"✓ gold_price_usd.csv ({len(df)} rows)")


def gen_co2_atmospheric():
    """Synthetic monthly atmospheric CO2 ppm — 780 months from 1959 (Mauna Loa-inspired)."""
    rng = np.random.default_rng(606)
    n = 780
    dates = pd.date_range("1959-01-01", periods=n, freq="MS")

    month = np.arange(n)
    # Linear trend: 315 → ~420 over 780 months
    trend = 315 + month * (420 - 315) / 780
    # Annual seasonal cycle (peaks May, trough Sep)
    month_of_year = np.arange(n) % 12
    season = 3.5 * np.sin((month_of_year - 4) * 2 * np.pi / 12)
    noise = rng.standard_normal(n) * 0.2

    co2 = trend + season + noise

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "co2_ppm": np.round(co2, 2),
    })
    df.to_csv(PRELOADED_DIR / "co2_atmospheric.csv", index=False)
    print(f"✓ co2_atmospheric.csv ({len(df)} rows)")


# ─── sample_datasets/ generators ──────────────────────────────────────────────

def gen_sample_bike_rentals():
    """200-row subset of bike rentals: date, count, temperature, humidity, windspeed."""
    rng = np.random.default_rng(111)
    n = 200
    dates = pd.date_range("2022-01-01", periods=n, freq="D")
    day_of_year = np.arange(n) % 365
    temperature = 8 + 14 * np.sin((day_of_year - 80) * 2 * np.pi / 365) + rng.standard_normal(n) * 2.5
    humidity = np.clip(60 + 20 * np.sin((day_of_year - 30) * 2 * np.pi / 365) + rng.standard_normal(n) * 8, 20, 100)
    windspeed = np.abs(15 + rng.standard_normal(n) * 6)
    weekday = np.array([d.weekday() for d in dates])
    weekend_boost = np.where(weekday >= 5, 1.3, 1.0)
    count = ((1500 + 80 * temperature - 30 * windspeed + rng.standard_normal(n) * 200) * weekend_boost).round().astype(int)
    count = np.maximum(count, 50)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "count": count,
        "temperature": np.round(temperature, 1),
        "humidity": np.round(humidity, 1),
        "windspeed": np.round(windspeed, 1),
    })
    df.to_csv(SAMPLE_DIR / "bike_rentals_sample.csv", index=False)
    print(f"✓ sample_datasets/bike_rentals_sample.csv ({len(df)} rows, 3 covariates)")


def gen_sample_retail_promo():
    """Synthetic weekly retail sales with promo_flag and holiday_flag."""
    rng = np.random.default_rng(222)
    n = 150
    dates = pd.date_range("2021-01-04", periods=n, freq="W-MON")
    week = np.arange(n)
    trend = 20000 + week * 40
    season = 3000 * np.sin(week * 2 * np.pi / 52)
    promo_flag = (rng.random(n) < 0.12).astype(int)
    holiday_flag = np.zeros(n, dtype=int)
    holiday_flag[[0, 51, 103]] = 1  # New Year / Christmas weeks approx
    promo_boost = promo_flag * rng.uniform(2000, 6000, n)
    holiday_boost = holiday_flag * 8000
    sales = (trend + season + rng.standard_normal(n) * 1000 + promo_boost + holiday_boost).round().astype(int)
    sales = np.maximum(sales, 5000)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "sales": sales,
        "promo_flag": promo_flag,
        "holiday_flag": holiday_flag,
    })
    df.to_csv(SAMPLE_DIR / "retail_with_promo.csv", index=False)
    print(f"✓ sample_datasets/retail_with_promo.csv ({len(df)} rows, 2 covariates)")


def gen_sample_energy_temp():
    """Synthetic daily energy demand with temperature and humidity."""
    rng = np.random.default_rng(333)
    n = 180
    dates = pd.date_range("2022-06-01", periods=n, freq="D")
    day_of_year = np.arange(n) % 365
    temperature_c = 18 + 10 * np.sin(day_of_year * 2 * np.pi / 365) + rng.standard_normal(n) * 2
    humidity_pct = np.clip(55 + 15 * np.sin(day_of_year * 2 * np.pi / 365) + rng.standard_normal(n) * 5, 20, 100)
    demand = (280 + (temperature_c - 18) ** 2 * 2 + rng.standard_normal(n) * 10)
    demand = np.maximum(demand, 50)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "demand_gwh": np.round(demand, 2),
        "temperature_c": np.round(temperature_c, 1),
        "humidity_pct": np.round(humidity_pct, 1),
    })
    df.to_csv(SAMPLE_DIR / "energy_temp_humidity.csv", index=False)
    print(f"✓ sample_datasets/energy_temp_humidity.csv ({len(df)} rows, 2 covariates)")


def gen_sample_single_clean():
    """Single clean monthly series, no covariates, 120 points."""
    rng = np.random.default_rng(444)
    n = 120
    dates = pd.date_range("2014-01-01", periods=n, freq="MS")
    month = np.arange(n)
    trend = 1000 + month * 3
    season = 80 * np.sin(month * 2 * np.pi / 12)
    noise = rng.standard_normal(n) * 30
    value = trend + season + noise

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "value": np.round(value, 2),
    })
    df.to_csv(SAMPLE_DIR / "single_series_clean.csv", index=False)
    print(f"✓ sample_datasets/single_series_clean.csv ({len(df)} rows, 0 covariates)")


def gen_sample_single_noisy():
    """Single noisy daily series with outliers and non-stationarity, 365 points."""
    rng = np.random.default_rng(555)
    n = 365
    dates = pd.date_range("2022-01-01", periods=n, freq="D")
    # Random walk (non-stationary)
    returns = rng.standard_normal(n) * 5 + 0.1
    value = np.cumsum(returns) + 500
    # Inject 8 outliers
    outlier_idx = rng.choice(n, size=8, replace=False)
    value[outlier_idx] += rng.choice([-1, 1], size=8) * rng.uniform(60, 120, 8)

    df = pd.DataFrame({
        "date": dates.strftime("%Y-%m-%d"),
        "value": np.round(value, 2),
    })
    df.to_csv(SAMPLE_DIR / "single_series_noisy.csv", index=False)
    print(f"✓ sample_datasets/single_series_noisy.csv ({len(df)} rows, non-stationary + outliers)")


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n── Generating preloaded datasets (11-16) ──")
    gen_bike_rentals()
    gen_supermarket_weekly()
    gen_energy_demand_temp()
    gen_us_cpi()
    gen_gold_price()
    gen_co2_atmospheric()

    print("\n── Generating sample_datasets/ ──")
    gen_sample_bike_rentals()
    gen_sample_retail_promo()
    gen_sample_energy_temp()
    gen_sample_single_clean()
    gen_sample_single_noisy()

    print(f"\n✓ Done. Preloaded: {PRELOADED_DIR}")
    print(f"✓ Done. Samples:   {SAMPLE_DIR}")
