import torch
import numpy as np

class ModelRegistry:
    _instance = None

    def __init__(self):
        self.chronos_pipeline = None
        self.timesfm_model = None
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
        if self.timesfm_model is None:
            print("Lazy loading TimesFM-200M into registry...")
            import timesfm
            self.timesfm_model = timesfm.TimesFm(
                hparams=timesfm.TimesFmHparams(
                    backend="cpu",
                    per_core_batch_size=1,
                    horizon_len=128,
                    context_len=512,
                    quantiles=[0.1, 0.5, 0.9]
                ),
                checkpoint=timesfm.TimesFmCheckpoint(
                    huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
                )
            )
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
        # Dual-Context Truncation: 512
        y_context = y[-512:] if len(y) > 512 else y
        inputs = [y_context.tolist()]
        point_forecast, quantiles_forecast = tfm.forecast(inputs, freq=[0])
        
        mean_pred = point_forecast[0][:h]
        lower_pred = quantiles_forecast[0][:h, 0]
        upper_pred = quantiles_forecast[0][:h, 2]
        return mean_pred, lower_pred, upper_pred

registry = ModelRegistry.get_instance()
