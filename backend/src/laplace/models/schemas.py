from typing import Literal

from pydantic import BaseModel, Field

Frequency = Literal["H", "D", "W", "M", "Q", "Y"]


class DatasetMeta(BaseModel):
    name: str
    description: str
    frequency: Frequency
    n_rows: int
    columns: list[str]
    domain: str | None = None
    covariate_cols: list[str] | None = None  # declared covariate columns (None = univariate)


class ColumnDetection(BaseModel):
    datetime_col: str | None = None
    target_col: str | None = None
    confidence: float = Field(ge=0, le=1)


class UploadResponse(BaseModel):
    columns: list[str]
    dtypes: dict[str, str]
    preview_rows: list[dict[str, str | float | None]]
    detected: ColumnDetection
    n_rows: int


class DatasetSelection(BaseModel):
    source: Literal["preloaded", "upload"]
    dataset_name: str | None = None
    datetime_col: str
    target_col: str
    frequency: Frequency | None = None
    covariate_cols: list[str] | None = None  # optional exogenous variable columns


class TimeSeriesData(BaseModel):
    dates: list[str]
    values: list[float]
    frequency: Frequency
    name: str
    n_points: int
    covariates: dict[str, list[float]] | None = None  # {col_name: [values...]}


class FrequencyInfo(BaseModel):
    frequency: Frequency
    period: int
    horizon_default: int
    label: str


class STLResult(BaseModel):
    observed: list[float]
    trend: list[float]
    seasonal: list[float]
    residual: list[float]


class ACFResult(BaseModel):
    acf_values: list[float]
    pacf_values: list[float]
    ci_upper: float
    ci_lower: float
    lags: list[int]


class ForecastabilityDimension(BaseModel):
    name: str
    score: float
    weight: float
    description: str


class ForecastabilityResult(BaseModel):
    total_score: float
    interpretation: str
    dimensions: list[ForecastabilityDimension]
    details: dict[str, float]


class DiagnosticsRequest(BaseModel):
    dates: list[str]
    values: list[float]
    frequency: Frequency
    name: str
    period_override: int | None = None  # Override auto-detected seasonality period (Lab)


class DescriptiveStats(BaseModel):
    count: int
    mean: float
    std: float
    min: float
    q1: float
    median: float
    q3: float
    max: float
    skewness: float
    kurtosis: float
    cv: float


class HistogramBin(BaseModel):
    x: float
    count: int


class DistributionResult(BaseModel):
    histogram: list[HistogramBin]
    normal_x: list[float]
    normal_y: list[float]
    mean: float
    std: float


class RollingStatsResult(BaseModel):
    rolling_mean: list[float]
    rolling_std: list[float]
    window: int


class OutlierResult(BaseModel):
    lower_bound: float
    upper_bound: float
    outlier_indices: list[int]
    outlier_values: list[float]
    n_outliers: int


class StationarityResult(BaseModel):
    adf_statistic: float
    adf_pvalue: float
    kpss_statistic: float
    kpss_pvalue: float
    is_stationary: bool
    verdict: str
    differenced: list[float]


class DiagnosticsResponse(BaseModel):
    stl: STLResult
    acf_pacf: ACFResult
    forecastability: ForecastabilityResult
    descriptive_stats: DescriptiveStats | None = None
    distribution: DistributionResult | None = None
    rolling_stats: RollingStatsResult | None = None
    outliers: OutlierResult | None = None
    stationarity: StationarityResult | None = None


class PreprocessingConfig(BaseModel):
    remove_outliers: bool = False
    outlier_method: Literal["iqr", "zscore"] = "iqr"
    outlier_replacement: Literal["interpolate", "winsorize"] = "interpolate"
    smooth: bool = False
    smooth_method: Literal["sma", "ema"] = "sma"
    smooth_window: int | None = None
    difference: bool = False
    difference_order: int = 1


class PreprocessingStep(BaseModel):
    operation: str
    description: str
    points_affected: int


class PreprocessedResult(BaseModel):
    values: list[float]
    dates: list[str]
    original_values: list[float]
    original_dates: list[str]
    log: list[PreprocessingStep]
    n_outliers_removed: int
    n_points_removed: int


class ModelForecast(BaseModel):
    model_name: str
    point_forecast: list[float]
    lo_90: list[float]
    lo_80: list[float]
    hi_80: list[float]
    hi_90: list[float]


class ForecastRequest(BaseModel):
    values: list[float]
    frequency: Frequency
    horizon: int | None = None
    model_name: str | None = None
    backtest_metrics: dict[str, "Metrics"] | None = None  # required for Ensemble
    covariates: dict[str, list[float]] | None = None       # historical exogenous values
    future_covariates: dict[str, list[float]] | None = None  # future exogenous values (horizon steps)


class ForecastResponse(BaseModel):
    forecasts: list[ModelForecast]
    horizon: int
    frequency: Frequency


class Metrics(BaseModel):
    mae: float
    rmse: float
    mape: float | None = None
    smape: float
    mase: float


class FoldResult(BaseModel):
    fold: int
    train_end_idx: int
    actual: list[float]
    forecasts: list[ModelForecast]
    metrics: dict[str, Metrics]


class BacktestRequest(BaseModel):
    values: list[float]
    frequency: Frequency
    horizon: int | None = None
    n_splits: int = 5
    covariates: dict[str, list[float]] | None = None  # historical exogenous values


class BacktestResponse(BaseModel):
    folds: list[FoldResult]
    aggregate_metrics: dict[str, Metrics]
    winner: str
    selection_metric: str
    horizon: int
    n_splits: int


FREQUENCY_MAP: dict[Frequency, FrequencyInfo] = {
    "H": FrequencyInfo(frequency="H", period=24, horizon_default=48, label="hours"),
    "D": FrequencyInfo(frequency="D", period=7, horizon_default=30, label="days"),
    "W": FrequencyInfo(frequency="W", period=52, horizon_default=12, label="weeks"),
    "M": FrequencyInfo(frequency="M", period=12, horizon_default=12, label="months"),
    "Q": FrequencyInfo(frequency="Q", period=4, horizon_default=4, label="quarters"),
    "Y": FrequencyInfo(frequency="Y", period=1, horizon_default=3, label="years"),
}


FREQ_TO_PANDAS: dict[Frequency, str] = {
    "H": "h",
    "D": "D",
    "W": "W",
    "M": "MS",
    "Q": "QS",
    "Y": "YS",
}
