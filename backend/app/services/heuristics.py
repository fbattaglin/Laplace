import pandas as pd
import numpy as np
from app.services.covariates import analyze_covariates

def detect_columns(df: pd.DataFrame) -> tuple[str | None, str | None]:
    """
    Heuristically detect the datetime column and the target (numeric) column.
    Returns a tuple of (datetime_col_name, target_col_name).
    """
    date_col = None
    target_col = None

    # 1. Detect Date Column
    datetime_cols = df.select_dtypes(include=['datetime64', 'datetimetz']).columns.tolist()
    if datetime_cols:
        date_col = datetime_cols[0]
    else:
        date_keywords = ['date', 'time', 'timestamp', 'ds', 'month', 'year', 'day', 'week']
        for col in df.columns:
            if any(keyword in col.lower() for keyword in date_keywords):
                if pd.api.types.is_numeric_dtype(df[col]):
                    if not ('year' in col.lower() or 'timestamp' in col.lower()):
                        continue
                try:
                    pd.to_datetime(df[col].dropna().head(10))
                    date_col = col
                    break
                except (ValueError, TypeError):
                    continue
        
        if not date_col:
            str_cols = df.select_dtypes(include=['object', 'string']).columns.tolist()
            for col in str_cols:
                try:
                    pd.to_datetime(df[col].dropna().head(10))
                    date_col = col
                    break
                except (ValueError, TypeError):
                    continue

    # 2. Detect Target Column
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if date_col in numeric_cols:
        numeric_cols.remove(date_col)

    if numeric_cols:
        target_keywords = ['target', 'value', 'y', 'sales', 'demand', 'price', 'qty', 'quantity', 'passengers', 'yield', 'mrr', 'level', 'cpi', 'views', 'volume']
        for col in numeric_cols:
            if any(keyword in col.lower() for keyword in target_keywords):
                target_col = col
                break
        
        if not target_col:
            for col in numeric_cols:
                if 'id' not in col.lower():
                    target_col = col
                    break
            
            if not target_col and numeric_cols:
                target_col = numeric_cols[0]

    return date_col, target_col

def process_dataframe(df: pd.DataFrame) -> dict:
    """
    Process dataframe to extract metadata and sample rows for the frontend.
    """
    date_col, target_col = detect_columns(df)
    columns = df.columns.tolist()
    df_filled = df.fillna("")
    
    n = len(df)
    if n <= 300:
        chart_rows = df_filled.to_dict(orient="records")
    else:
        import numpy as np_h
        indices = np_h.linspace(0, n - 1, 300, dtype=int)
        chart_rows = df_filled.iloc[indices].to_dict(orient="records")
    
    covariate_candidates = []
    if date_col and target_col:
        try:
            covariate_candidates = analyze_covariates(df, date_col, target_col)
        except Exception as e:
            print(f"Failed to analyze covariates: {e}")

    return {
        "columns": columns,
        "suggested_date_col": date_col,
        "suggested_target_col": target_col,
        "total_rows": len(df),
        "preview_data": df_filled.head(15).to_dict(orient="records"),
        "chart_data": chart_rows,
        "covariate_candidates": covariate_candidates,
    }
