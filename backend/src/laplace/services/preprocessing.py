import logging

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from laplace.models.schemas import PreprocessedResult, PreprocessingConfig, PreprocessingStep

logger = logging.getLogger(__name__)


def remove_outliers(
    values: list[float],
    method: str = "iqr",
    replacement: str = "interpolate",
) -> tuple[list[float], PreprocessingStep]:
    arr = np.array(values, dtype=np.float64)

    if method == "iqr":
        q1, q3 = np.percentile(arr, [25, 75])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        mask = (arr < lower) | (arr > upper)
        method_label = "IQR (1.5×)"
    else:  # zscore
        z = np.abs(scipy_stats.zscore(arr))
        mask = z > 3.0
        method_label = "Z-score (|z|>3)"

    n_outliers = int(mask.sum())

    if n_outliers == 0:
        return values, PreprocessingStep(
            operation="remove_outliers",
            description=f"No outliers found ({method_label})",
            points_affected=0,
        )

    result = arr.copy()
    result[mask] = np.nan

    if replacement == "interpolate":
        s = pd.Series(result)
        s = s.interpolate(method="linear").ffill().bfill()
        result = s.values
        desc = f"Replaced {n_outliers} outlier(s) with linear interpolation ({method_label})"
    else:  # winsorize
        if method == "iqr":
            q1, q3 = np.percentile(arr[~mask], [25, 75])
            iqr = q3 - q1
            lower = q1 - 1.5 * iqr
            upper = q3 + 1.5 * iqr
        else:
            non_outlier = arr[~mask]
            lower, upper = non_outlier.min(), non_outlier.max()
        result = arr.copy()
        result[mask] = np.clip(result[mask], lower, upper)
        desc = f"Winsorized {n_outliers} outlier(s) to bounds ({method_label})"

    return result.tolist(), PreprocessingStep(
        operation="remove_outliers",
        description=desc,
        points_affected=n_outliers,
    )


def smooth(
    values: list[float],
    method: str = "sma",
    window: int | None = None,
) -> tuple[list[float], PreprocessingStep]:
    arr = np.array(values, dtype=np.float64)
    n = len(arr)

    if window is None:
        window = max(3, min(n // 10, 12))

    window = max(2, min(window, n // 2))

    if method == "sma":
        s = pd.Series(arr).rolling(window=window, center=True, min_periods=1).mean()
        result = s.values
        desc = f"Simple moving average (window={window})"
    else:  # ema
        s = pd.Series(arr).ewm(span=window, adjust=False).mean()
        result = s.values
        desc = f"Exponential moving average (span={window})"

    return result.tolist(), PreprocessingStep(
        operation="smooth",
        description=desc,
        points_affected=n,
    )


def difference(
    values: list[float],
    order: int = 1,
) -> tuple[list[float], PreprocessingStep]:
    arr = np.array(values, dtype=np.float64)

    for _ in range(order):
        arr = np.diff(arr, n=1)

    n_removed = len(values) - len(arr)
    desc = f"Applied {order}{'st' if order == 1 else 'nd'}-order differencing (removed {n_removed} leading point{'s' if n_removed != 1 else ''})"

    return arr.tolist(), PreprocessingStep(
        operation="difference",
        description=desc,
        points_affected=n_removed,
    )


def apply_preprocessing(
    values: list[float],
    dates: list[str],
    config: PreprocessingConfig,
) -> PreprocessedResult:
    original_values = list(values)
    original_dates = list(dates)
    current_values = list(values)
    current_dates = list(dates)
    log: list[PreprocessingStep] = []
    n_outliers_removed = 0
    n_points_removed = 0

    if config.remove_outliers:
        current_values, step = remove_outliers(
            current_values,
            method=config.outlier_method,
            replacement=config.outlier_replacement,
        )
        log.append(step)
        n_outliers_removed = step.points_affected

    if config.smooth:
        current_values, step = smooth(
            current_values,
            method=config.smooth_method,
            window=config.smooth_window,
        )
        log.append(step)

    if config.difference:
        before_len = len(current_values)
        current_values, step = difference(current_values, order=config.difference_order)
        # Trim dates to match new length
        n_removed = before_len - len(current_values)
        current_dates = current_dates[n_removed:]
        log.append(step)
        n_points_removed += n_removed

    if not log:
        log.append(PreprocessingStep(
            operation="none",
            description="No preprocessing applied",
            points_affected=0,
        ))

    return PreprocessedResult(
        values=current_values,
        dates=current_dates,
        original_values=original_values,
        original_dates=original_dates,
        log=log,
        n_outliers_removed=n_outliers_removed,
        n_points_removed=n_points_removed,
    )
