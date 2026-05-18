"""Tests for covariate (exogenous variable) support in the forecasting pipeline."""

import numpy as np
import pytest

from laplace.services.forecasting import run_all_models
from laplace.services.backtest import rolling_origin_cv
from laplace.services.parser import validate_and_prepare
import pandas as pd


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_series(n: int = 120) -> list[float]:
    rng = np.random.default_rng(42)
    return (100 + rng.standard_normal(n) * 5).tolist()


def make_covariates(n: int = 120) -> dict[str, list[float]]:
    rng = np.random.default_rng(7)
    return {
        "temperature": (20 + rng.standard_normal(n) * 3).tolist(),
        "humidity": (60 + rng.standard_normal(n) * 5).tolist(),
    }


# ─── run_all_models with covariates ──────────────────────────────────────────

class TestRunAllModelsWithCovariates:
    def test_runs_without_exception(self):
        """Covariates must not crash run_all_models (graceful univariate fallback)."""
        values = make_series(60)
        covs = make_covariates(60)
        # Should complete without raising
        results = run_all_models(values, horizon=6, frequency="M", covariates=covs)
        assert len(results) >= 3  # at least StatsForecast trio

    def test_output_shape_unchanged(self):
        """Covariate presence must not affect the forecast output structure."""
        values = make_series(60)
        horizon = 6
        results_no_cov = run_all_models(values, horizon, "M")
        results_with_cov = run_all_models(values, horizon, "M", covariates=make_covariates(60))

        assert len(results_no_cov) == len(results_with_cov)
        for r in results_with_cov:
            assert len(r.point_forecast) == horizon
            assert len(r.lo_80) == horizon
            assert len(r.hi_80) == horizon

    def test_none_covariates_is_equivalent(self):
        """Explicitly passing None covariates must behave like passing no covariates."""
        values = make_series(50)
        r1 = run_all_models(values, 4, "M", covariates=None)
        r2 = run_all_models(values, 4, "M")
        # Same model names in same order
        names1 = [r.model_name for r in r1]
        names2 = [r.model_name for r in r2]
        assert names1 == names2


# ─── Backtest with covariates ─────────────────────────────────────────────────

class TestBacktestWithCovariates:
    def test_completes_without_exception(self):
        values = make_series(120)
        covs = make_covariates(120)
        result = rolling_origin_cv(values, "M", horizon=6, n_splits=2, covariates=covs)
        assert result.n_splits >= 1
        assert len(result.folds) >= 1

    def test_covariate_fold_split_no_leakage(self):
        """Train-window covariates must never extend past train_end_idx."""
        values = make_series(120)
        covs = make_covariates(120)

        # Monkey-patch run_all_models to capture call args
        captured: list[dict] = []
        import laplace.services.backtest as bt_module
        original = bt_module.run_all_models

        def spy(vals, horizon, freq, covariates=None, future_covariates=None):
            captured.append({"n_train": len(vals), "cov_lens": {k: len(v) for k, v in (covariates or {}).items()}})
            return original(vals, horizon, freq, covariates, future_covariates)

        bt_module.run_all_models = spy
        try:
            result = rolling_origin_cv(values, "M", horizon=6, n_splits=2, covariates=covs)
        finally:
            bt_module.run_all_models = original

        for call in captured:
            for cov_name, cov_len in call["cov_lens"].items():
                assert cov_len == call["n_train"], (
                    f"Covariate '{cov_name}' has {cov_len} values but train window is {call['n_train']}"
                )

    def test_covariate_fold_count_matches_no_cov(self):
        """Adding covariates must not change the number of folds."""
        values = make_series(120)
        covs = make_covariates(120)
        r_plain = rolling_origin_cv(values, "M", horizon=6, n_splits=3)
        r_cov = rolling_origin_cv(values, "M", horizon=6, n_splits=3, covariates=covs)
        assert r_plain.n_splits == r_cov.n_splits


# ─── Parser covariate extraction ──────────────────────────────────────────────

class TestParserCovariates:
    def _make_df(self, n: int = 60) -> pd.DataFrame:
        rng = np.random.default_rng(0)
        dates = pd.date_range("2018-01-01", periods=n, freq="MS").strftime("%Y-%m-%d")
        return pd.DataFrame({
            "date": dates,
            "sales": (1000 + rng.standard_normal(n) * 50).tolist(),
            "temperature": (15 + rng.standard_normal(n) * 5).tolist(),
            "promo": rng.integers(0, 2, size=n).astype(float).tolist(),
        })

    def test_covariates_extracted_correctly(self):
        df = self._make_df()
        result = validate_and_prepare(df, "date", "sales", "M", covariate_cols=["temperature", "promo"])
        assert result.covariates is not None
        assert "temperature" in result.covariates
        assert "promo" in result.covariates
        assert len(result.covariates["temperature"]) == result.n_points
        assert len(result.covariates["promo"]) == result.n_points

    def test_no_covariates_returns_none(self):
        df = self._make_df()
        result = validate_and_prepare(df, "date", "sales", "M")
        assert result.covariates is None

    def test_empty_covariate_cols_returns_none(self):
        df = self._make_df()
        result = validate_and_prepare(df, "date", "sales", "M", covariate_cols=[])
        assert result.covariates is None

    def test_invalid_covariate_col_is_silently_skipped(self):
        """Columns that don't exist in the dataframe must be ignored."""
        df = self._make_df()
        result = validate_and_prepare(df, "date", "sales", "M", covariate_cols=["nonexistent", "temperature"])
        assert result.covariates is not None
        assert "nonexistent" not in result.covariates
        assert "temperature" in result.covariates

    def test_covariate_same_col_as_target_is_skipped(self):
        """Using the target column as a covariate must be silently skipped."""
        df = self._make_df()
        result = validate_and_prepare(df, "date", "sales", "M", covariate_cols=["sales", "temperature"])
        assert result.covariates is not None
        assert "sales" not in result.covariates
        assert "temperature" in result.covariates

    def test_covariate_missing_values_are_interpolated(self):
        """Sparse covariates with up to 3 consecutive NaNs must be filled."""
        df = self._make_df()
        df.loc[10:12, "temperature"] = float("nan")  # 3 consecutive NaNs
        result = validate_and_prepare(df, "date", "sales", "M", covariate_cols=["temperature"])
        assert result.covariates is not None
        assert all(np.isfinite(v) for v in result.covariates["temperature"])
