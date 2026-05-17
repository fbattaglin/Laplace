import torch
import numpy as np
try:
    print("Testing Chronos with 1024 points...")
    from chronos import ChronosPipeline
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    pipeline = ChronosPipeline.from_pretrained("amazon/chronos-t5-small", device_map=device, torch_dtype=torch.float32)
    y = np.random.randn(1024)
    forecast = pipeline.predict(torch.tensor(y), prediction_length=12)
    print("Chronos 1024 OK. Shape:", forecast.shape)
except Exception as e:
    print("Chronos failed:", e)

try:
    print("Testing TimesFM with 1024 points...")
    import timesfm
    tfm = timesfm.TimesFm(
        hparams=timesfm.TimesFmHparams(
            backend="cpu",
            per_core_batch_size=1,
            horizon_len=128,
            context_len=1024,
            quantiles=[0.1, 0.5, 0.9]
        ),
        checkpoint=timesfm.TimesFmCheckpoint(
            huggingface_repo_id="google/timesfm-1.0-200m-pytorch"
        )
    )
    y = np.random.randn(1024).tolist()
    point, quantiles = tfm.forecast([y], freq=[0])
    print("TimesFM 1024 OK. Shape:", point.shape)
except Exception as e:
    print("TimesFM failed:", e)
