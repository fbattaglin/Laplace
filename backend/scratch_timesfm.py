import timesfm
import numpy as np

inputs = [np.sin(np.linspace(0, 20, 100)).tolist()]

try:
    tfm = timesfm.TimesFm(
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
    
    # Run forecast
    point_forecast, experimental_quantile_forecast = tfm.forecast(
        inputs,
        freq=[0]
    )
    
    print("Point forecast shape:", point_forecast.shape)
    print("Quantile forecast shape:", experimental_quantile_forecast.shape)
    # the returned shapes will be (1, 128), we just slice it if we only want 12.
    
except Exception as e:
    import traceback
    traceback.print_exc()
