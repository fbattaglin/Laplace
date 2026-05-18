import logging
import threading

import numpy as np
import pandas as pd
import torch
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoTheta, SeasonalNaive

from laplace.models.schemas import (
    FREQ_TO_PANDAS,
    FREQUENCY_MAP,
    Frequency,
    ModelForecast,
)

logger = logging.getLogger(__name__)


class ChronosSingleton:
    _instance = None
    _lock = threading.Lock()
    _pipeline = None

    @classmethod
    def get_pipeline(cls):
        if cls._pipeline is None:
            with cls._lock:
                if cls._pipeline is None:
                    cls._pipeline = cls._load()
        return cls._pipeline

    @classmethod
    def _load(cls):
        from chronos import BaseChronosPipeline

        device = "mps" if torch.backends.mps.is_available() else "cpu"
        logger.info(f"Loading Chronos-2-Small on device: {device}")
        pipeline = BaseChronosPipeline.from_pretrained(
            "autogluon/chronos-2-small",
            device_map=device,
            dtype=torch.float32,
        )
        return pipeline


TIMESFM_FREQ_MAP = {"H": 0, "D": 0, "W": 1, "M": 1, "Q": 2, "Y": 2}


class TimesFMSingleton:
    _instance = None
    _lock = threading.Lock()
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            with cls._lock:
                if cls._model is None:
                    cls._model = cls._load()
        return cls._model

    @classmethod
    def _load(cls):
        import timesfm

        logger.info("Loading TimesFM 2.0 (500M)")
        model = timesfm.TimesFm(
            hparams=timesfm.TimesFmHparams(
                context_len=512,
                horizon_len=128,
                input_patch_len=32,
                output_patch_len=128,
                num_layers=50,
                num_heads=16,
                model_dims=1280,
                per_core_batch_size=32,
                backend="cpu",
                quantiles=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
            ),
            checkpoint=timesfm.TimesFmCheckpoint(
                huggingface_repo_id="google/timesfm-2.0-500m-pytorch",
            ),
        )
        return model


def run_timesfm(
    values: list[float], horizon: int, frequency: Frequency = "M"
) -> ModelForecast:
    model = TimesFMSingleton.get_model()
    freq_int = TIMESFM_FREQ_MAP.get(frequency, 1)
    point_forecast, quantile_forecast = model.forecast(
        [values], freq=[freq_int]
    )
    # quantile_forecast shape: (1, horizon_len, 10)
    # columns: [mean, q10, q20, q30, q40, q50, q60, q70, q80, q90]
    q = quantile_forecast[0, :horizon, :]

    return ModelForecast(
        model_name="TimesFM",
        point_forecast=_clean(q[:, 5]),
        lo_90=_clean(q[:, 1]),
        lo_80=_clean(q[:, 2]),
        hi_80=_clean(q[:, 8]),
        hi_90=_clean(q[:, 9]),
    )


def run_chronos(values: list[float], horizon: int) -> ModelForecast:
    pipeline = ChronosSingleton.get_pipeline()
    context = torch.tensor([[values]], dtype=torch.float32)

    quantile_levels = [0.1, 0.2, 0.5, 0.8, 0.9]
    quantiles, _ = pipeline.predict_quantiles(
        context,
        prediction_length=horizon,
        quantile_levels=quantile_levels,
    )

    q = quantiles[0][0].numpy()

    return ModelForecast(
        model_name="Chronos-2",
        point_forecast=q[:, 2].tolist(),
        lo_90=q[:, 0].tolist(),
        lo_80=q[:, 1].tolist(),
        hi_80=q[:, 3].tolist(),
        hi_90=q[:, 4].tolist(),
    )


def run_statsforecast(
    values: list[float], horizon: int, frequency: Frequency
) -> list[ModelForecast]:
    period = FREQUENCY_MAP[frequency].period
    freq_str = FREQ_TO_PANDAS[frequency]

    season_length = max(period, 2)

    models = [
        AutoETS(season_length=season_length, model="ZZZ"),
        AutoTheta(season_length=season_length, decomposition_type="multiplicative"),
        SeasonalNaive(season_length=season_length),
    ]

    df = pd.DataFrame({
        "unique_id": ["series"] * len(values),
        "ds": pd.date_range("2000-01-01", periods=len(values), freq=freq_str),
        "y": values,
    })

    sf = StatsForecast(
        models=models,
        freq=freq_str,
        n_jobs=1,
        fallback_model=SeasonalNaive(season_length=season_length),
    )
    sf.fit(df=df)
    forecasts_df = sf.predict(h=horizon, level=[80, 90])
    forecasts_df = forecasts_df.reset_index()

    results = []
    model_configs = [
        ("AutoETS", "AutoETS"),
        ("AutoTheta", "AutoTheta"),
        ("SeasonalNaive", "SeasonalNaive"),
    ]

    for model_name, alias in model_configs:
        point = forecasts_df[alias].values
        lo_90 = forecasts_df[f"{alias}-lo-90"].values
        lo_80 = forecasts_df[f"{alias}-lo-80"].values
        hi_80 = forecasts_df[f"{alias}-hi-80"].values
        hi_90 = forecasts_df[f"{alias}-hi-90"].values

        results.append(ModelForecast(
            model_name=model_name,
            point_forecast=_clean(point),
            lo_90=_clean(lo_90),
            lo_80=_clean(lo_80),
            hi_80=_clean(hi_80),
            hi_90=_clean(hi_90),
        ))

    return results


def run_all_models(
    values: list[float],
    horizon: int,
    frequency: Frequency,
    covariates: dict[str, list[float]] | None = None,
    future_covariates: dict[str, list[float]] | None = None,
) -> list[ModelForecast]:
    if covariates:
        logger.info(
            "Covariates provided (%s) — current models run univariate; "
            "exogenous variable support will be added in a future model update.",
            list(covariates.keys()),
        )

    results = []

    try:
        chronos_result = run_chronos(values, horizon)
        results.append(chronos_result)
    except Exception as e:
        logger.warning(f"Chronos-2 failed: {e}")

    try:
        timesfm_result = run_timesfm(values, horizon, frequency)
        results.append(timesfm_result)
    except Exception as e:
        logger.warning(f"TimesFM failed: {e}")

    try:
        sf_results = run_statsforecast(values, horizon, frequency)
        results.extend(sf_results)
    except Exception as e:
        logger.warning(f"StatsForecast failed: {e}")

    return results


def _clean(arr: np.ndarray) -> list[float]:
    return [float(x) if np.isfinite(x) else 0.0 for x in arr]
