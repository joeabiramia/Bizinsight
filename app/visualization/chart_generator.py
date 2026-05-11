import pandas as pd

def generate_charts(df):

    charts = []

    numeric_cols = df.select_dtypes(include=["number"]).columns
    categorical_cols = df.select_dtypes(include=["object"]).columns

    # Histograms for numeric columns
    for col in numeric_cols:
        charts.append({
            "type": "histogram",
            "column": col
        })

    # Bar charts for categorical columns
    for col in categorical_cols:
        charts.append({
            "type": "bar",
            "column": col
        })

    # Correlation heatmap
    if len(numeric_cols) > 1:
        charts.append({
            "type": "correlation_heatmap"
        })

    return charts