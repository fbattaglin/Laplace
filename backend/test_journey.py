import requests
import time

URL_VAL = "http://127.0.0.1:8000/api/validation"
URL_FOR = "http://127.0.0.1:8000/api/forecast"

payload_val = {
    "dataset_type": "reference",
    "dataset_name": "air_passengers",
    "date_col": "Month",
    "target_col": "Passengers",
    "horizon": 12,
    "selected_models": ["SeasonalNaive", "Chronos-T5-Small"]
}

print("Running Validation...")
r1 = requests.post(URL_VAL, json=payload_val)
if r1.status_code == 200:
    print("Validation Success")
else:
    print("Validation Failed:", r1.text)

print("Waiting 2 seconds...")
time.sleep(2)

payload_for = {
    "dataset_type": "reference",
    "dataset_name": "air_passengers",
    "date_col": "Month",
    "target_col": "Passengers",
    "model_name": "Chronos-T5-Small",
    "horizon": 12
}

print("Running Forecast...")
r2 = requests.post(URL_FOR, json=payload_for)
if r2.status_code == 200:
    print("Forecast Success")
else:
    print("Forecast Failed:", r2.text)

