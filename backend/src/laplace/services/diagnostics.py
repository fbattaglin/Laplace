import numpy as np
import pandas as pd
from scipy import stats as scipy_stats
from scipy.signal import periodogram
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.stattools import acf, adfuller, kpss, pacf

from laplace.models.schemas import FREQUENCY_MAP, Frequency


def compute_stl(
    values: list[float], frequency: Frequency, period_override: int | None = None,
) -> dict:
    period = period_override if period_override and period_override >= 2 else FREQUENCY_MAP[frequency].period
    arr = np.array(values, dtype=np.float64)
    n = len(arr)

    if period < 2 or n < 2 * period:
        trend = pd.Series(arr).rolling(window=max(3, n // 5), center=True).mean().ffill().bfill()
        seasonal = np.zeros(n)
        residual = arr - trend.values
        return {
            "dates_index": list(range(n)),
            "observed": arr.tolist(),
            "trend": trend.tolist(),
            "seasonal": seasonal.tolist(),
            "residual": residual.tolist(),
        }

    seasonal_param = period if period % 2 == 1 else period + 1

    stl = STL(arr, period=period, seasonal=seasonal_param, robust=True)
    result = stl.fit()

    return {
        "dates_index": list(range(n)),
        "observed": arr.tolist(),
        "trend": result.trend.tolist(),
        "seasonal": result.seasonal.tolist(),
        "residual": result.resid.tolist(),
    }


def compute_acf_pacf(values: list[float], n_lags: int | None = None) -> dict:
    arr = np.array(values, dtype=np.float64)
    n = len(arr)

    if n_lags is None:
        n_lags = min(n // 2 - 1, 40)
    n_lags = max(1, min(n_lags, n // 2 - 1))

    acf_values = acf(arr, nlags=n_lags, fft=True)
    pacf_values = pacf(arr, nlags=min(n_lags, n // 2 - 1))

    ci = 1.96 / np.sqrt(n)

    return {
        "acf_values": acf_values.tolist(),
        "pacf_values": pacf_values.tolist(),
        "ci_upper": float(ci),
        "ci_lower": float(-ci),
        "lags": list(range(len(acf_values))),
    }


def _signal_strength(arr: np.ndarray, frequency: Frequency, period_override: int | None = None) -> tuple[float, float, float]:
    """Compute trend and seasonal strength from STL decomposition (Hyndman et al.)."""
    period = period_override if period_override and period_override >= 2 else FREQUENCY_MAP[frequency].period

    if period < 2 or len(arr) < 2 * period:
        trend_series = pd.Series(arr).rolling(window=max(3, len(arr) // 5), center=True).mean()
        trend_series = trend_series.ffill().bfill()
        residual = arr - trend_series.values
        var_resid = float(np.var(residual))
        var_total = float(np.var(arr))
        trend_strength = max(0.0, 1.0 - var_resid / (var_total + 1e-10))
        return trend_strength, 0.0, (trend_strength * 0.6) * 100

    seasonal_param = period if period % 2 == 1 else period + 1
    stl = STL(arr, period=period, seasonal=seasonal_param, robust=True)
    result = stl.fit()

    var_resid = float(np.var(result.resid))
    var_trend_resid = float(np.var(result.trend + result.resid))
    var_seasonal_resid = float(np.var(result.seasonal + result.resid))

    trend_strength = max(0.0, 1.0 - var_resid / (var_trend_resid + 1e-10))
    seasonal_strength = max(0.0, 1.0 - var_resid / (var_seasonal_resid + 1e-10))

    combined = 0.6 * trend_strength + 0.4 * seasonal_strength
    return trend_strength, seasonal_strength, combined * 100


def _regularity(arr: np.ndarray) -> float:
    """Inverse spectral entropy — higher = more regular/predictable."""
    detrended = arr - np.polyval(np.polyfit(np.arange(len(arr)), arr, 1), np.arange(len(arr)))

    freqs, pxx = periodogram(detrended)
    pxx = pxx[1:]  # remove DC component

    if len(pxx) == 0 or np.sum(pxx) < 1e-10:
        return 50.0

    pxx_norm = pxx / np.sum(pxx)
    pxx_norm = pxx_norm[pxx_norm > 0]

    spectral_entropy = -np.sum(pxx_norm * np.log2(pxx_norm))
    max_entropy = np.log2(len(pxx_norm))

    if max_entropy < 1e-10:
        return 50.0

    normalized_entropy = spectral_entropy / max_entropy
    return float((1.0 - normalized_entropy) * 100)


def _stationarity(arr: np.ndarray) -> float:
    """Combined ADF/KPSS stationarity assessment."""
    try:
        adf_pvalue = adfuller(arr, autolag="AIC")[1]
        adf_stationary = 1 if adf_pvalue < 0.05 else 0
    except Exception:
        adf_stationary = 0

    try:
        kpss_pvalue = kpss(arr, regression="c", nlags="auto")[1]
        kpss_stationary = 1 if kpss_pvalue > 0.05 else 0
    except Exception:
        kpss_stationary = 0

    score_map = {
        (1, 1): 100.0,
        (1, 0): 80.0,
        (0, 1): 60.0,
        (0, 0): 30.0,
    }
    return score_map[(adf_stationary, kpss_stationary)]


def _sample_adequacy(n: int, frequency: Frequency, period_override: int | None = None) -> float:
    """Score based on having enough data relative to seasonal period."""
    period = period_override if period_override and period_override >= 2 else FREQUENCY_MAP[frequency].period
    min_required = max(3 * period, 30)
    ratio = min(n / min_required, 1.0)
    return float(ratio * 100)


def _noise_level(arr: np.ndarray, frequency: Frequency, period_override: int | None = None) -> float:
    """Lower remainder variance relative to total = cleaner signal."""
    period = period_override if period_override and period_override >= 2 else FREQUENCY_MAP[frequency].period
    var_total = float(np.var(arr))

    if var_total < 1e-10:
        return 100.0

    if period < 2 or len(arr) < 2 * period:
        trend = pd.Series(arr).rolling(window=max(3, len(arr) // 5), center=True).mean()
        trend = trend.ffill().bfill()
        residual = arr - trend.values
    else:
        seasonal_param = period if period % 2 == 1 else period + 1
        stl = STL(arr, period=period, seasonal=seasonal_param, robust=True)
        result = stl.fit()
        residual = result.resid

    var_resid = float(np.var(residual))
    noise_ratio = var_resid / var_total

    return float(max(0.0, (1.0 - noise_ratio) * 100))


def compute_descriptive_stats(values: list[float]) -> dict:
    arr = np.array(values, dtype=np.float64)
    q1, median, q3 = np.percentile(arr, [25, 50, 75])
    mean = float(np.mean(arr))
    std = float(np.std(arr, ddof=1))
    return {
        "count": len(arr),
        "mean": round(mean, 4),
        "std": round(std, 4),
        "min": round(float(np.min(arr)), 4),
        "q1": round(float(q1), 4),
        "median": round(float(median), 4),
        "q3": round(float(q3), 4),
        "max": round(float(np.max(arr)), 4),
        "skewness": round(float(scipy_stats.skew(arr)), 4),
        "kurtosis": round(float(scipy_stats.kurtosis(arr)), 4),
        "cv": round(std / mean if abs(mean) > 1e-10 else 0.0, 4),
    }


def compute_distribution(values: list[float]) -> dict:
    arr = np.array(values, dtype=np.float64)
    n_bins = min(30, max(10, int(np.sqrt(len(arr)))))
    counts, bin_edges = np.histogram(arr, bins=n_bins)
    bin_centers = 0.5 * (bin_edges[:-1] + bin_edges[1:])

    mean = float(np.mean(arr))
    std = float(np.std(arr, ddof=1))

    normal_x = np.linspace(arr.min(), arr.max(), 100).tolist()
    if std > 1e-10:
        normal_y = scipy_stats.norm.pdf(normal_x, mean, std)
        bin_width = bin_edges[1] - bin_edges[0]
        normal_y = (normal_y * len(arr) * bin_width).tolist()
    else:
        normal_y = [0.0] * 100

    return {
        "histogram": [{"x": round(float(x), 4), "count": int(c)} for x, c in zip(bin_centers, counts)],
        "normal_x": [round(float(x), 4) for x in normal_x],
        "normal_y": [round(float(y), 4) for y in normal_y],
        "mean": round(mean, 4),
        "std": round(std, 4),
    }


def compute_rolling_stats(values: list[float], frequency: Frequency, period_override: int | None = None) -> dict:
    arr = np.array(values, dtype=np.float64)
    period = period_override if period_override and period_override >= 2 else FREQUENCY_MAP[frequency].period
    window = max(period, min(len(arr) // 4, 30))

    s = pd.Series(arr)
    rolling_mean = s.rolling(window=window, center=True).mean().ffill().bfill()
    rolling_std = s.rolling(window=window, center=True).std().ffill().bfill()

    return {
        "rolling_mean": [round(float(x), 4) for x in rolling_mean],
        "rolling_std": [round(float(x), 4) for x in rolling_std],
        "window": window,
    }


def compute_outliers(values: list[float]) -> dict:
    arr = np.array(values, dtype=np.float64)
    q1, q3 = np.percentile(arr, [25, 75])
    iqr = q3 - q1
    lower = float(q1 - 1.5 * iqr)
    upper = float(q3 + 1.5 * iqr)

    outlier_mask = (arr < lower) | (arr > upper)
    indices = np.where(outlier_mask)[0].tolist()

    return {
        "lower_bound": round(lower, 4),
        "upper_bound": round(upper, 4),
        "outlier_indices": indices,
        "outlier_values": [round(float(arr[i]), 4) for i in indices],
        "n_outliers": len(indices),
    }


def compute_stationarity(values: list[float]) -> dict:
    arr = np.array(values, dtype=np.float64)

    try:
        adf_stat, adf_pvalue = adfuller(arr, autolag="AIC")[:2]
        adf_stat, adf_pvalue = float(adf_stat), float(adf_pvalue)
    except Exception:
        adf_stat, adf_pvalue = 0.0, 1.0

    try:
        kpss_stat, kpss_pvalue = kpss(arr, regression="c", nlags="auto")[:2]
        kpss_stat, kpss_pvalue = float(kpss_stat), float(kpss_pvalue)
    except Exception:
        kpss_stat, kpss_pvalue = 0.0, 0.0

    adf_stationary = adf_pvalue < 0.05
    kpss_stationary = kpss_pvalue > 0.05
    is_stationary = adf_stationary and kpss_stationary

    if adf_stationary and kpss_stationary:
        verdict = "Stationary — both ADF and KPSS agree."
    elif adf_stationary and not kpss_stationary:
        verdict = "Trend-stationary — ADF rejects unit root, KPSS detects trend."
    elif not adf_stationary and kpss_stationary:
        verdict = "Difference-stationary — unit root present, differencing recommended."
    else:
        verdict = "Non-stationary — both tests agree series has a unit root."

    differenced = np.diff(arr).tolist()

    return {
        "adf_statistic": round(adf_stat, 4),
        "adf_pvalue": round(adf_pvalue, 4),
        "kpss_statistic": round(kpss_stat, 4),
        "kpss_pvalue": round(kpss_pvalue, 4),
        "is_stationary": is_stationary,
        "verdict": verdict,
        "differenced": [round(float(x), 4) for x in differenced],
    }


def compute_forecastability(
    values: list[float], frequency: Frequency, period_override: int | None = None,
) -> dict:
    """
    Composite forecastability score (0-100) with 5 weighted dimensions.

    Based on Hyndman et al. STL features and spectral entropy (Wang et al. 2025).
    """
    arr = np.array(values, dtype=np.float64)

    trend_str, seasonal_str, signal_score = _signal_strength(arr, frequency, period_override)
    regularity_score = _regularity(arr)
    stationarity_score = _stationarity(arr)
    adequacy_score = _sample_adequacy(len(arr), frequency, period_override)
    noise_score = _noise_level(arr, frequency, period_override)

    weights = {
        "signal_strength": 0.40,
        "regularity": 0.25,
        "stationarity": 0.15,
        "sample_adequacy": 0.10,
        "noise_level": 0.10,
    }

    total = (
        weights["signal_strength"] * signal_score
        + weights["regularity"] * regularity_score
        + weights["stationarity"] * stationarity_score
        + weights["sample_adequacy"] * adequacy_score
        + weights["noise_level"] * noise_score
    )

    total = max(0.0, min(100.0, total))

    if total >= 70:
        interpretation = "High — strong learnable patterns with clear trend and/or seasonality."
    elif total >= 45:
        interpretation = "Moderate — some structure present, but noise limits precision."
    else:
        interpretation = "Low — series is dominated by noise; expect wide prediction intervals."

    dimensions = [
        {
            "name": "Signal Strength",
            "score": round(signal_score, 1),
            "weight": weights["signal_strength"],
            "description": "How much of the variation comes from trend and seasonality vs. noise.",
        },
        {
            "name": "Regularity",
            "score": round(regularity_score, 1),
            "weight": weights["regularity"],
            "description": (
                "How concentrated the frequency spectrum is — regular patterns score high."
            ),
        },
        {
            "name": "Stationarity",
            "score": round(stationarity_score, 1),
            "weight": weights["stationarity"],
            "description": "Whether statistical properties remain constant over time.",
        },
        {
            "name": "Sample Adequacy",
            "score": round(adequacy_score, 1),
            "weight": weights["sample_adequacy"],
            "description": "Whether there is enough data relative to the seasonal cycle length.",
        },
        {
            "name": "Noise Level",
            "score": round(noise_score, 1),
            "weight": weights["noise_level"],
            "description": "How clean the signal is after removing trend and seasonality.",
        },
    ]

    return {
        "total_score": round(total, 1),
        "interpretation": interpretation,
        "dimensions": dimensions,
        "details": {
            "trend_strength": round(trend_str, 3),
            "seasonal_strength": round(seasonal_str, 3),
        },
    }
