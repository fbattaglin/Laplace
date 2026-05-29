import logging
import torch
import numpy as np

logger = logging.getLogger("laplace.core.model_registry")

class ModelRegistry:
    _instance = None
    TIMESFM_Q_LOW = 0   # 0.1 quantile
    TIMESFM_Q_MID = 4   # 0.5 quantile
    TIMESFM_Q_HIGH = 8  # 0.9 quantile

    def __init__(self):
        self.chronos_pipeline = None
        self.timesfm_model = None
        self._timesfm_failed = False
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance

    def get_chronos(self):
        if self.chronos_pipeline is None:
            logger.info("Lazy loading amazon/chronos-2 into registry...")
            from chronos import BaseChronosPipeline
            self.chronos_pipeline = BaseChronosPipeline.from_pretrained(
                "amazon/chronos-2", 
                device_map=self.device, 
                torch_dtype=torch.float32
            )
        return self.chronos_pipeline

    def get_timesfm(self):
        if self._timesfm_failed:
            raise RuntimeError("TimesFM failed to load previously — skipping retry.")
        if self.timesfm_model is None:
            logger.info("Lazy loading TimesFM-200M into registry...")
            import timesfm
            try:
                self.timesfm_model = timesfm.TimesFm(
                    hparams=timesfm.TimesFmHparams(
                        backend="cpu",
                        per_core_batch_size=1,
                        horizon_len=128,
                        context_len=512,
                    ),
                    checkpoint=timesfm.TimesFmCheckpoint(
                        huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
                    )
                )
            except Exception as e:
                self._timesfm_failed = True
                logger.error(f"TimesFM failed to load: {e}")
                raise RuntimeError(f"TimesFM failed to load: {e}") from e
        return self.timesfm_model

    def predict_chronos(self, y: np.ndarray, h: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        pipeline = self.get_chronos()
        y_context = y[-1024:] if len(y) > 1024 else y
        context_tensor = torch.tensor(y_context, dtype=torch.float32)
        forecast = pipeline.predict(context_tensor, prediction_length=h)
        samples = forecast[0].numpy()
        mean_pred = np.quantile(samples, 0.5, axis=0)
        lower_pred = np.quantile(samples, 0.1, axis=0)
        upper_pred = np.quantile(samples, 0.9, axis=0)
        return mean_pred, lower_pred, upper_pred

    def predict_chronos2(self, y: np.ndarray, h: int, past_covariates: np.ndarray = None) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        pipeline = self.get_chronos()
        y_context = y[-1024:] if len(y) > 1024 else y
        
        payload = {"target": y_context}
        
        if past_covariates is not None:
            past_cov_context = past_covariates[-1024:] if len(past_covariates) > 1024 else past_covariates
            num_covs = past_cov_context.shape[1] if len(past_cov_context.shape) > 1 else 1
            if len(past_cov_context.shape) == 1:
                past_cov_context = past_cov_context.reshape(-1, 1)
            
            cov_dict = {}
            for i in range(num_covs):
                cov_dict[f"cov_{i}"] = past_cov_context[:, i]
                
            payload["past_covariates"] = cov_dict
            
        quantiles, mean = pipeline.predict_quantiles([payload], prediction_length=h, quantile_levels=[0.1, 0.5, 0.9])
        
        if isinstance(mean, list):
            mean_pred = mean[0][0].numpy()
            lower_pred = quantiles[0][0, :, 0].numpy()
            upper_pred = quantiles[0][0, :, 2].numpy()
        else:
            mean_pred = mean[0].numpy()
            lower_pred = quantiles[0, :, 0].numpy()
            upper_pred = quantiles[0, :, 2].numpy()
        
        return mean_pred, lower_pred, upper_pred

    def predict_timesfm(self, y: np.ndarray, h: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        tfm = self.get_timesfm()
        y_context = y[-512:] if len(y) > 512 else y
        inputs = [y_context.tolist()]
        point_forecast, quantiles_forecast = tfm.forecast(inputs, freq=[0])
        
        mean_pred = point_forecast[0][:h]
        lower_pred = quantiles_forecast[0][:h, self.TIMESFM_Q_LOW]
        upper_pred = quantiles_forecast[0][:h, self.TIMESFM_Q_HIGH]
        return mean_pred, lower_pred, upper_pred

registry = ModelRegistry.get_instance()
