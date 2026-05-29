from typing import Any
from pydantic import BaseModel

class DatasetInfo(BaseModel):
    name: str
    description: str
    problem_statement: str
    tags: list[str]
    has_covariates: bool = False

class DiagnosticsRequest(BaseModel):
    dataset_type: str  # "reference" or "upload"
    dataset_name: str
    date_col: str
    target_col: str

class ValidationRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    horizon: int = 12
    selected_models: list[str] | None = None
    covariate_cols: list[str] | None = None
    cleaning_config: list[dict[str, Any]] | None = None
    excluded_anomalies: list[int] | None = None
    validation_type: str = "holdout"  # "holdout" or "walk_forward"
    num_splits: int = 3
    ensemble_config: dict[str, Any] | None = None

class CleanRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    config: list[dict[str, Any]]

class AnomalyRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    method: str = "isolation_forest"
    threshold: float = 0.05

class ForecastRequest(BaseModel):
    dataset_type: str
    dataset_name: str
    date_col: str
    target_col: str
    model_name: str
    horizon: int = 12
    covariate_cols: list[str] | None = None
    cleaning_config: list[dict[str, Any]] | None = None
    excluded_anomalies: list[int] | None = None
    ensemble_config: dict[str, Any] | None = None
