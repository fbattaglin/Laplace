import os
import sys
import pandas as pd
import numpy as np

# Ensure backend path is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(backend_dir)
os.chdir(backend_dir)

from app.services.covariates import add_calendar_features
from app.services.forecast import run_forecast

def test_calendar_feature_engineering():
    print("\n--- Testing Calendar Feature Engineering on Wikipedia Web Traffic ---")
    df = pd.read_csv("data/website_traffic.csv")
    
    print(f"Original columns: {list(df.columns)}")
    df_engineered = add_calendar_features(df, "Date")
    print(f"Engineered columns: {list(df_engineered.columns)}")
    
    assert "calendar_is_weekend" in df_engineered.columns, "Should have engineered weekend column"
    assert "calendar_is_holiday" in df_engineered.columns, "Should have engineered holiday column"
    
    # Check that weekend is 1.0 on Saturdays and Sundays
    df_engineered["Date"] = pd.to_datetime(df_engineered["Date"])
    saturdays = df_engineered[df_engineered["Date"].dt.dayofweek == 5]
    sundays = df_engineered[df_engineered["Date"].dt.dayofweek == 6]
    weekdays = df_engineered[df_engineered["Date"].dt.dayofweek < 5]
    
    assert (saturdays["calendar_is_weekend"] == 1.0).all(), "Saturdays must be weekends"
    assert (sundays["calendar_is_weekend"] == 1.0).all(), "Sundays must be weekends"
    assert (weekdays["calendar_is_weekend"] == 0.0).all(), "Weekdays must not be weekends"
    print("✓ Successfully verified weekend calendar features!")
    
    # Check holidays (July 4th)
    july_4th = df_engineered[df_engineered["Date"].dt.strftime("%m-%d") == "07-04"]
    if not july_4th.empty:
        print(f"✓ July 4th holiday flag value: {july_4th['calendar_is_holiday'].tolist()}")
        assert (july_4th["calendar_is_holiday"] == 1.0).any(), "July 4th should be recognized as a holiday"
    print("✓ Successfully verified holiday calendar features!")

def test_what_if_simulation_arimax():
    print("\n--- Testing ARIMAX What-If Simulation on Marketing ROI ---")
    df = pd.read_csv("data/marketing_roi.csv")
    
    h = 12
    covariate_cols = ["Ad_Spend"]
    
    # 1. Run Baseline Forecast (Ad_Spend remains constant at last known value, say 100.0)
    baseline_res = run_forecast(
        df=df,
        date_col="Date",
        target_col="Daily_Sales",
        model_name="ARIMA",
        h=h,
        covariate_cols=covariate_cols,
        future_covariates=None
    )
    baseline_sales = baseline_res["forecast"]["mean"]
    print(f"Baseline future sales (first 3): {baseline_sales[:3]}")
    
    # 2. Run Simulated Forecast (Ad_Spend is increased to 3000.0)
    simulated_ad_spend = [3000.0] * h
    sim_res = run_forecast(
        df=df,
        date_col="Date",
        target_col="Daily_Sales",
        model_name="ARIMA",
        h=h,
        covariate_cols=covariate_cols,
        future_covariates={"Ad_Spend": simulated_ad_spend}
    )
    simulated_sales = sim_res["forecast"]["mean"]
    print(f"Simulated future sales (first 3): {simulated_sales[:3]}")
    
    # Let's verify that higher Ad Spend increases Sales!
    # Ad_Spend and Daily_Sales in marketing_roi have a high positive correlation (+0.83).
    # Therefore, increasing the budget must result in a higher forecast!
    assert simulated_sales[0] > baseline_sales[0], "Higher Ad Spend must increase sales in ARIMAX forecast!"
    print("✓ Successfully verified ARIMAX What-If sensitivity!")
    print(f"  Sales shift at step 1: {baseline_sales[0]:.2f} → {simulated_sales[0]:.2f} (+{(simulated_sales[0] - baseline_sales[0]):.2f} units)")

if __name__ == "__main__":
    print("LOG: Starting Sprint 2 features E2E verification...")
    test_calendar_feature_engineering()
    test_what_if_simulation_arimax()
    print("\nALL SPRINT 2 VERIFICATIONS COMPLETED SUCCESSFULLY!")
