import numpy as np

from laplace.models.schemas import (
    FREQUENCY_MAP,
    BacktestResponse,
    FoldResult,
    Frequency,
    Metrics,
)
from laplace.services.forecasting import run_all_models


def compute_metrics(
    actual: np.ndarray, predicted: np.ndarray, seasonal_naive_mae: float | None = None
) -> Metrics:
    errors = actual - predicted
    abs_errors = np.abs(errors)

    mae = float(np.mean(abs_errors))
    rmse = float(np.sqrt(np.mean(errors**2)))

    has_zeros = np.any(actual == 0)
    if has_zeros or np.any(np.abs(actual) < 1e-10):
        mape = None
    else:
        mape = float(np.mean(np.abs(errors / actual)) * 100)

    denominator = np.abs(actual) + np.abs(predicted)
    safe_denom = np.where(denominator < 1e-10, 1.0, denominator)
    smape = float(np.mean(2 * abs_errors / safe_denom) * 100)

    if seasonal_naive_mae is not None and seasonal_naive_mae > 1e-10:
        mase = mae / seasonal_naive_mae
    else:
        mase = float("inf")

    return Metrics(
        mae=round(mae, 4),
        rmse=round(rmse, 4),
        mape=round(mape, 2) if mape is not None else None,
        smape=round(smape, 2),
        mase=round(mase, 4),
    )


def _seasonal_naive_mae(values: np.ndarray, period: int) -> float:
    if period < 2 or len(values) <= period:
        diffs = np.abs(np.diff(values))
        return float(np.mean(diffs)) if len(diffs) > 0 else 1.0
    naive_errors = np.abs(values[period:] - values[:-period])
    return float(np.mean(naive_errors))


def rolling_origin_cv(
    values: list[float],
    frequency: Frequency,
    horizon: int,
    n_splits: int = 5,
    covariates: dict[str, list[float]] | None = None,
) -> BacktestResponse:
    arr = np.array(values, dtype=np.float64)
    n = len(arr)
    period = FREQUENCY_MAP[frequency].period

    min_train = max(2 * period, 30, horizon + period)
    available = n - min_train
    if available < horizon:
        raise ValueError(
            f"Not enough data for backtest: need at least {min_train + horizon} points, "
            f"got {n}"
        )

    max_possible_splits = available // horizon
    n_splits = min(n_splits, max_possible_splits)
    n_splits = max(1, n_splits)

    folds: list[FoldResult] = []

    for i in range(n_splits):
        test_end = n - i * horizon
        test_start = test_end - horizon
        train_end = test_start

        if train_end < min_train:
            break

        train_values = arr[:train_end].tolist()
        actual = arr[test_start:test_end]

        # Slice covariates at the same training boundary (no leakage)
        train_covariates: dict[str, list[float]] | None = None
        if covariates:
            train_covariates = {col: vals[:train_end] for col, vals in covariates.items()}

        model_forecasts = run_all_models(train_values, horizon, frequency, train_covariates)

        sn_mae = _seasonal_naive_mae(arr[:train_end], period)

        fold_metrics: dict[str, Metrics] = {}
        for mf in model_forecasts:
            predicted = np.array(mf.point_forecast[:horizon])
            fold_metrics[mf.model_name] = compute_metrics(actual, predicted, sn_mae)

        folds.append(FoldResult(
            fold=len(folds) + 1,
            train_end_idx=train_end,
            actual=actual.tolist(),
            forecasts=model_forecasts,
            metrics=fold_metrics,
        ))

    folds.reverse()

    aggregate_metrics = _aggregate_metrics(folds)
    winner = _select_winner(aggregate_metrics)

    return BacktestResponse(
        folds=folds,
        aggregate_metrics=aggregate_metrics,
        winner=winner,
        selection_metric="smape",
        horizon=horizon,
        n_splits=len(folds),
    )


def _aggregate_metrics(folds: list[FoldResult]) -> dict[str, Metrics]:
    if not folds:
        return {}

    model_names = set()
    for fold in folds:
        model_names.update(fold.metrics.keys())

    result = {}
    for name in model_names:
        fold_metrics = [f.metrics[name] for f in folds if name in f.metrics]
        if not fold_metrics:
            continue

        avg_mae = np.mean([m.mae for m in fold_metrics])
        avg_rmse = np.mean([m.rmse for m in fold_metrics])
        mapes = [m.mape for m in fold_metrics if m.mape is not None]
        avg_mape = np.mean(mapes) if mapes else None
        avg_smape = np.mean([m.smape for m in fold_metrics])
        finite_mases = [m.mase for m in fold_metrics if np.isfinite(m.mase)]
        avg_mase = np.mean(finite_mases) if finite_mases else float("inf")

        result[name] = Metrics(
            mae=round(float(avg_mae), 4),
            rmse=round(float(avg_rmse), 4),
            mape=round(float(avg_mape), 2) if avg_mape is not None else None,
            smape=round(float(avg_smape), 2),
            mase=round(float(avg_mase), 4) if np.isfinite(avg_mase) else 999.0,
        )

    return result


def _select_winner(aggregate_metrics: dict[str, Metrics]) -> str:
    if not aggregate_metrics:
        return "unknown"

    best_name = min(aggregate_metrics, key=lambda k: aggregate_metrics[k].smape)
    return best_name
