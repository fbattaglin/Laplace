import torch
import numpy as np

class ModelRegistry:
    _instance = None
    # DEFAULT_QUANTILES = (0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9) - indices 0,4,8
    TIMESFM_Q_LOW = 0   # 0.1 quantile
    TIMESFM_Q_MID = 4   # 0.5 quantile
    TIMESFM_Q_HIGH = 8  # 0.9 quantile

    def __init__(self):
        self.chronos_pipeline = None
        self.timesfm_model = None
        self._timesfm_failed = False  # prevents repeated failed load attempts
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = ModelRegistry()
        return cls._instance

    def get_chronos(self):
        if self.chronos_pipeline is None:
            print("Lazy loading Chronos-T5-Small into registry...")
            from chronos import ChronosPipeline
            self.chronos_pipeline = ChronosPipeline.from_pretrained(
                "amazon/chronos-t5-small", 
                device_map=self.device, 
                torch_dtype=torch.float32
            )
        return self.chronos_pipeline

    def get_timesfm(self):
        if self._timesfm_failed:
            raise RuntimeError("TimesFM failed to load previously — skipping retry.")
        if self.timesfm_model is None:
            print("Lazy loading TimesFM-200M into registry...")
            import timesfm
            try:
                self.timesfm_model = timesfm.TimesFm(
                    hparams=timesfm.TimesFmHparams(
                        backend="cpu",
                        per_core_batch_size=1,
                        horizon_len=128,
                        context_len=512,
                        # DO NOT override quantiles — the checkpoint requires the default
                        # 9-quantile layout: (0.1,0.2,...,0.9) which gives output_dims=1280
                    ),
                    checkpoint=timesfm.TimesFmCheckpoint(
                        huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
                    )
                )
            except Exception as e:
                self._timesfm_failed = True
                raise RuntimeError(f"TimesFM failed to load: {e}") from e
        return self.timesfm_model

    def predict_chronos(self, y: np.ndarray, h: int):
        pipeline = self.get_chronos()
        # Dual-Context Truncation: 1024
        y_context = y[-1024:] if len(y) > 1024 else y
        context_tensor = torch.tensor(y_context, dtype=torch.float32)
        forecast = pipeline.predict(context_tensor, prediction_length=h)
        samples = forecast[0].numpy()
        mean_pred = np.quantile(samples, 0.5, axis=0)
        lower_pred = np.quantile(samples, 0.1, axis=0)
        upper_pred = np.quantile(samples, 0.9, axis=0)
        return mean_pred, lower_pred, upper_pred

    def predict_timesfm(self, y: np.ndarray, h: int):
        tfm = self.get_timesfm()
        # Dual-Context Truncation: 512 (TimesFM hard physical limit)
        y_context = y[-512:] if len(y) > 512 else y
        inputs = [y_context.tolist()]
        point_forecast, quantiles_forecast = tfm.forecast(inputs, freq=[0])
        
        mean_pred = point_forecast[0][:h]
        # Default quantiles are (0.1,0.2,...,0.9) — extract P10, P50, P90 by index
        lower_pred = quantiles_forecast[0][:h, self.TIMESFM_Q_LOW]   # 0.1
        upper_pred = quantiles_forecast[0][:h, self.TIMESFM_Q_HIGH]  # 0.9
        return mean_pred, lower_pred, upper_pred

registry = ModelRegistry.get_instance()
