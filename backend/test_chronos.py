import torch
from chronos import ChronosPipeline
import numpy as np

try:
    print("Testing Chronos-Bolt-Small...")
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    pipeline = ChronosPipeline.from_pretrained("amazon/chronos-bolt-small", device_map=device, torch_dtype=torch.float32)
    context = torch.tensor([1.0, 2.0, 3.0, 4.0, 5.0])
    forecast = pipeline.predict(context, prediction_length=3)
    print("Success:", forecast[0].numpy().shape)
except Exception as e:
    import traceback
    traceback.print_exc()
