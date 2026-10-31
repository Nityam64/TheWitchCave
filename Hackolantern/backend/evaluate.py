import os
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from ml_engine.ai_core import (
    predict_moving_average_7d,
    predict_same_weekday_4w,
    predict_holt_winters
)

def evaluate_models(csv_path: str = None):
    if not csv_path:
        csv_path = os.path.join(os.path.dirname(__file__), "data", "sample_sales_data.csv")

    if not os.path.exists(csv_path):
        print(f"Error: Sample sales file not found at {csv_path}")
        return

    df = pd.read_csv(csv_path)
    
    # Ensure correct column names
    col_map = {c.lower().strip(): c for c in df.columns}
    date_col = col_map.get("date", "date")
    name_col = col_map.get("ingredient_name", col_map.get("ingredient_id", "ingredient_name"))
    id_col = col_map.get("ingredient_id", name_col)
    units_col = col_map.get("units_sold", col_map.get("quantity", "units_sold"))

    df["dt"] = pd.to_datetime(df[date_col])
    
    results = []
    best_per_ingredient = {}
    model_totals = {
        "moving_average_7d": {"mae": 0.0, "mape": 0.0, "count": 0},
        "same_weekday_4w": {"mae": 0.0, "mape": 0.0, "count": 0},
        "holt_winters": {"mae": 0.0, "mape": 0.0, "count": 0}
    }

    print("\n==========================================================================================")
    print("                     EVALUATING INGREDIENT DEMAND FORECAST MODELS")
    print("==========================================================================================")
    print("Train Horizon: Full history minus last 14 days | Test Horizon: Last 14 days")
    print("------------------------------------------------------------------------------------------")
    print(f"{'Ingredient':<18} | {'Model':<20} | {'MAE':<8} | {'MAPE (%)':<10} | {'Status'}")
    print("------------------------------------------------------------------------------------------")

    for (ing_id, ing_name), group in df.groupby([id_col, name_col]):
        group = group.sort_values("dt")
        dates = group["dt"].dt.strftime("%Y-%m-%d").tolist()
        series = group[units_col].astype(float).tolist()

        if len(series) < 18:
            continue

        # Hold out the last 14 days
        train_dates = dates[:-14]
        train_series = series[:-14]
        test_dates = dates[-14:]
        test_series = np.array(series[-14:], dtype=float)

        models_eval = {}

        # 1. 7-day Moving Average
        preds_ma, _ = predict_moving_average_7d(train_series, steps=14)
        preds_ma_arr = np.array(preds_ma)
        mae_ma = float(np.mean(np.abs(test_series - preds_ma_arr)))
        mape_ma = float(np.mean(np.abs(test_series - preds_ma_arr) / np.maximum(test_series, 1.0))) * 100
        models_eval["moving_average_7d"] = (mae_ma, mape_ma)

        # 2. Same-Weekday Average (last 4 weeks)
        preds_sw, _ = predict_same_weekday_4w(train_dates, train_series, test_dates)
        preds_sw_arr = np.array(preds_sw)
        mae_sw = float(np.mean(np.abs(test_series - preds_sw_arr)))
        mape_sw = float(np.mean(np.abs(test_series - preds_sw_arr) / np.maximum(test_series, 1.0))) * 100
        models_eval["same_weekday_4w"] = (mae_sw, mape_sw)

        # 3. Holt-Winters Exponential Smoothing
        preds_hw, _ = predict_holt_winters(train_dates, train_series, test_dates)
        preds_hw_arr = np.array(preds_hw)
        mae_hw = float(np.mean(np.abs(test_series - preds_hw_arr)))
        mape_hw = float(np.mean(np.abs(test_series - preds_hw_arr) / np.maximum(test_series, 1.0))) * 100
        models_eval["holt_winters"] = (mae_hw, mape_hw)

        # Determine winner for this ingredient (lowest MAE)
        best_model = min(models_eval, key=lambda m: models_eval[m][0])
        best_per_ingredient[str(ing_id)] = best_model
        best_per_ingredient[str(ing_name).lower().replace(" ", "_")] = best_model

        for m_name, (mae, mape) in models_eval.items():
            is_best = (m_name == best_model)
            star = "★ BEST" if is_best else ""
            print(f"{ing_name:<18} | {m_name:<20} | {mae:<8.2f} | {mape:<9.1f}% | {star}")
            model_totals[m_name]["mae"] += mae
            model_totals[m_name]["mape"] += mape
            model_totals[m_name]["count"] += 1
        print("------------------------------------------------------------------------------------------")

    # Overall Summary
    print("\nOVERALL SUMMARY:")
    overall_best = None
    min_overall_mae = float("inf")
    for m_name, stats in model_totals.items():
        if stats["count"] > 0:
            avg_mae = stats["mae"] / stats["count"]
            avg_mape = stats["mape"] / stats["count"]
            print(f" - {m_name:<20}: Average MAE = {avg_mae:.2f}, Average MAPE = {avg_mape:.1f}%")
            if avg_mae < min_overall_mae:
                min_overall_mae = avg_mae
                overall_best = m_name

    print(f"\n=> Winning Model Overall: {overall_best} (Avg MAE: {min_overall_mae:.2f})\n")

    # Save to config file
    config_data = {
        "best_model_overall": overall_best,
        "best_per_ingredient": best_per_ingredient,
        "model_stats": {
            m: {
                "avg_mae": round(stats["mae"] / max(stats["count"], 1), 2),
                "avg_mape": round(stats["mape"] / max(stats["count"], 1), 1)
            }
            for m, stats in model_totals.items()
        },
        "last_evaluated_at": datetime.now().isoformat()
    }
    
    config_path = os.path.join(os.path.dirname(__file__), "model_config.json")
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)
    print(f"Model configuration saved to: {config_path}")

if __name__ == "__main__":
    evaluate_models()

