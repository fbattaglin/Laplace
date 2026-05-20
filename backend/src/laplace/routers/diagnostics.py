from fastapi import APIRouter, HTTPException

from laplace.models.schemas import (
    ACFResult,
    DescriptiveStats,
    DiagnosticsRequest,
    DiagnosticsResponse,
    DistributionResult,
    ForecastabilityDimension,
    ForecastabilityResult,
    HistogramBin,
    OutlierResult,
    RollingStatsResult,
    STLResult,
    StationarityResult,
)
from laplace.services.diagnostics import (
    compute_acf_pacf,
    compute_descriptive_stats,
    compute_distribution,
    compute_forecastability,
    compute_outliers,
    compute_rolling_stats,
    compute_stationarity,
    compute_stl,
)

router = APIRouter(prefix="/api/diagnostics", tags=["diagnostics"])


@router.post("", response_model=DiagnosticsResponse)
async def run_diagnostics(request: DiagnosticsRequest):
    if len(request.values) < 10:
        raise HTTPException(status_code=422, detail="Need at least 10 data points for diagnostics")

    period_override = request.period_override

    stl_raw = compute_stl(request.values, request.frequency, period_override)
    acf_raw = compute_acf_pacf(request.values)
    forecast_raw = compute_forecastability(request.values, request.frequency, period_override)
    desc_raw = compute_descriptive_stats(request.values)
    dist_raw = compute_distribution(request.values)
    rolling_raw = compute_rolling_stats(request.values, request.frequency, period_override)
    outlier_raw = compute_outliers(request.values)
    stat_raw = compute_stationarity(request.values)

    stl = STLResult(
        observed=stl_raw["observed"],
        trend=stl_raw["trend"],
        seasonal=stl_raw["seasonal"],
        residual=stl_raw["residual"],
    )

    acf_pacf = ACFResult(
        acf_values=acf_raw["acf_values"],
        pacf_values=acf_raw["pacf_values"],
        ci_upper=acf_raw["ci_upper"],
        ci_lower=acf_raw["ci_lower"],
        lags=acf_raw["lags"],
    )

    forecastability = ForecastabilityResult(
        total_score=forecast_raw["total_score"],
        interpretation=forecast_raw["interpretation"],
        dimensions=[ForecastabilityDimension(**d) for d in forecast_raw["dimensions"]],
        details=forecast_raw["details"],
    )

    descriptive_stats = DescriptiveStats(**desc_raw)

    distribution = DistributionResult(
        histogram=[HistogramBin(**b) for b in dist_raw["histogram"]],
        normal_x=dist_raw["normal_x"],
        normal_y=dist_raw["normal_y"],
        mean=dist_raw["mean"],
        std=dist_raw["std"],
    )

    rolling_stats = RollingStatsResult(
        rolling_mean=rolling_raw["rolling_mean"],
        rolling_std=rolling_raw["rolling_std"],
        window=rolling_raw["window"],
    )

    outliers = OutlierResult(
        lower_bound=outlier_raw["lower_bound"],
        upper_bound=outlier_raw["upper_bound"],
        outlier_indices=outlier_raw["outlier_indices"],
        outlier_values=outlier_raw["outlier_values"],
        n_outliers=outlier_raw["n_outliers"],
    )

    stationarity = StationarityResult(
        adf_statistic=stat_raw["adf_statistic"],
        adf_pvalue=stat_raw["adf_pvalue"],
        kpss_statistic=stat_raw["kpss_statistic"],
        kpss_pvalue=stat_raw["kpss_pvalue"],
        is_stationary=stat_raw["is_stationary"],
        verdict=stat_raw["verdict"],
        differenced=stat_raw["differenced"],
    )

    return DiagnosticsResponse(
        stl=stl,
        acf_pacf=acf_pacf,
        forecastability=forecastability,
        descriptive_stats=descriptive_stats,
        distribution=distribution,
        rolling_stats=rolling_stats,
        outliers=outliers,
        stationarity=stationarity,
    )
