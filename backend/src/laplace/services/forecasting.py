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
        from chronos.chronos_bolt import ChronosBoltConfig

        original_init = ChronosBoltConfig.__init__
        original_fields = {f.name for f in ChronosBoltConfig.__dataclass_fields__.values()}

        def _patched_init(self, **kwargs):
            filtered = {k: v for k, v in kwargs.items() if k in original_fields}
            original_init(self, **filtered)

        ChronosBoltConfig.__init__ = _patched_init
        try:
            device = "mps" if torch.backends.mps.is_available() else "cpu"
            logger.info(f"Loading Chronos-Bolt-Small on device: {device}")
            pipeline = BaseChronosPipeline.from_pretrained(
                "amazon/chronos-bolt-small",
                device_map=device,
                dtype=torch.float32,
            )
        finally:
            ChronosBoltConfig.__init__ = original_init
        return pipeline


def run_chronos(values: list[float], horizon: int) -> ModelForecast:
    pipeline = ChronosSingleton.get_pipeline()
    context = torch.tensor([values], dtype=torch.float32)

    quantile_levels = [0.1, 0.2, 0.5, 0.8, 0.9]
    quantiles, _ = pipeline.predict_quantiles(
        context,
        prediction_length=horizon,
        quantile_levels=quantile_levels,
    )

    q = quantiles[0].numpy()

    return ModelForecast(
        model_name="Chronos-Bolt",
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
    values: list[float], horizon: int, frequency: Frequency
) -> list[ModelForecast]:
    results = []

    try:
        chronos_result = run_chronos(values, horizon)
        results.append(chronos_result)
    except Exception as e:
        logger.warning(f"Chronos failed: {e}")

    try:
        sf_results = run_statsforecast(values, horizon, frequency)
        results.extend(sf_results)
    except Exception as e:
        logger.warning(f"StatsForecast failed: {e}")

    return results


def _clean(arr: np.ndarray) -> list[float]:
    return [float(x) if np.isfinite(x) else 0.0 for x in arr]
