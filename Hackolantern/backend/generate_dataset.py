"""
Synthetic Dataset Generator for The Witch's Potion Pantry
Generates realistic sales data with weekly patterns, Poisson noise,
mild upward trends, past festival spikes, and unlabelled anomalies.
"""

import os
import csv
import datetime
import numpy as np

# Fixed random seed for complete reproducibility
RANDOM_SEED = 42

INGREDIENTS_CONFIG = [
    {
        "ingredient_id": "bat_wings",
        "ingredient_name": "Bat Wings",
        "category": "Animal Parts",
        "current_stock": 45,
        "safety_stock": 20,
        "supplier": "Crow's Corner",
        "lead_time_days": 4,
        "is_cursed": False,
        "base_demand": 9.2,
        # Mon-Thu ~0.90, Fri ~1.08, Sat ~1.35 (+35%), Sun ~1.25 (+25%)
        "weekday_weights": [0.90, 0.90, 0.90, 0.92, 1.08, 1.35, 1.25],
        # Mild upward autumn potion trend: +20% over 90 days
        "trend_slope": 0.20,
        "festival": True,
    },
    {
        "ingredient_id": "mandrake_root",
        "ingredient_name": "Mandrake Root",
        "category": "Roots",
        "current_stock": 18,  # Low stock near safety stock
        "safety_stock": 15,
        "supplier": "Silver Vale",
        "lead_time_days": 3,
        "is_cursed": False,
        "base_demand": 4.5,
        # Mon-Wed ~0.91, Thu ~0.95, Fri ~1.05, Sat ~1.25 (+25%), Sun ~1.15 (+15%)
        "weekday_weights": [0.92, 0.90, 0.92, 0.95, 1.05, 1.25, 1.15],
        "trend_slope": 0.0,
        "festival": False,
        "spike_date": "2026-08-25",
        "spike_qty": 19,
        "spike_desc": "Emergency coven batch brew (one-off spike)",
    },
    {
        "ingredient_id": "ghost_pepper",
        "ingredient_name": "Ghost Pepper",
        "category": "Spices",
        "current_stock": 60,  # Comfortable stock
        "safety_stock": 25,
        "supplier": "Moon Market",
        "lead_time_days": 2,
        "is_cursed": True,
        "base_demand": 8.8,
        # Mon-Thu ~0.89, Fri ~1.20, Sat ~1.40 (+40%), Sun ~1.15
        "weekday_weights": [0.88, 0.88, 0.90, 0.92, 1.20, 1.40, 1.15],
        # Mild upward seasonal spice trend: +15% over 90 days
        "trend_slope": 0.15,
        "festival": True,
    },
    {
        "ingredient_id": "newt_eyes",
        "ingredient_name": "Newt Eyes",
        "category": "Animal Parts",
        "current_stock": 90,  # Comfortable stock
        "safety_stock": 30,
        "supplier": "Swamp Den",
        "lead_time_days": 5,
        "is_cursed": False,
        "base_demand": 5.3,
        # Mon-Thu ~0.91, Fri ~1.05, Sat ~1.30 (+30%), Sun ~1.25 (+25%)
        "weekday_weights": [0.90, 0.90, 0.92, 0.92, 1.05, 1.30, 1.25],
        "trend_slope": 0.0,
        "festival": True,
    },
    {
        "ingredient_id": "moonpetal_dust",
        "ingredient_name": "Moonpetal Dust",
        "category": "Powders",
        "current_stock": 48,  # Comfortable stock
        "safety_stock": 15,
        "supplier": "Silver Vale",
        "lead_time_days": 3,
        "is_cursed": True,
        "base_demand": 3.5,
        # Mon-Thu ~0.90, Fri ~1.10, Sat ~1.35 (+35%), Sun ~1.20 (+20%)
        "weekday_weights": [0.90, 0.90, 0.90, 0.92, 1.10, 1.35, 1.20],
        "trend_slope": 0.0,
        "festival": False,
        "spike_date": "2026-09-18",
        "spike_qty": 16,
        "spike_desc": "Lunar eclipse potion preparation (one-off spike)",
    },
    {
        "ingredient_id": "frost_honey",
        "ingredient_name": "Frost Honey",
        "category": "Sweeteners",
        "current_stock": 14,  # Low stock near safety stock
        "safety_stock": 12,
        "supplier": "Hollow Hive",
        "lead_time_days": 2,
        "is_cursed": False,
        "base_demand": 2.2,
        # Mon-Fri ~0.92, Sat ~1.10, Sun ~1.35 (+35% Sunday tea peak)
        "weekday_weights": [0.92, 0.92, 0.90, 0.90, 0.95, 1.10, 1.35],
        "trend_slope": 0.0,
        "festival": False,
        "spike_date": "2026-10-19",
        "spike_qty": 11,
        "spike_desc": "Unseasonable early frost fever epidemic (one-off spike)",
    },
    {
        "ingredient_id": "rose_root",
        "ingredient_name": "Rose Root",
        "category": "Herbs",
        "current_stock": 70,  # Comfortable stock
        "safety_stock": 20,
        "supplier": "Greenhollow",
        "lead_time_days": 1,
        "is_cursed": False,
        "base_demand": 5.4,
        # Mon-Thu ~0.92, Fri ~1.15, Sat ~1.30 (+30%), Sun ~1.10
        "weekday_weights": [0.92, 0.90, 0.92, 0.95, 1.15, 1.30, 1.10],
        "trend_slope": 0.0,
        "festival": False,
    }
]

# Festival config: Past festival around 2026-10-04 to 2026-10-06 (3 days)
FESTIVAL_DATES = ["2026-10-04", "2026-10-05", "2026-10-06"]
FESTIVAL_MULTIPLIER = 3.0

CSV_FIELDNAMES = [
    "date",
    "ingredient_id",
    "ingredient_name",
    "category",
    "current_stock",
    "safety_stock",
    "supplier",
    "lead_time_days",
    "is_cursed",
    "units_sold"
]

ANOMALY_FIELDNAMES = [
    "date",
    "ingredient_id",
    "ingredient_name",
    "anomaly_type",
    "multiplier",
    "units_sold",
    "baseline_expected",
    "notes"
]


def generate_all(data_dir: str = None, seed: int = RANDOM_SEED):
    """
    Generates:
    1. sample_sales_data.csv (90 days ending 2026-10-31)
    2. holdout_future.csv (14 days from 2026-11-01 to 2026-11-14)
    3. anomaly_labels.csv (dates and ingredients of injected spikes and festival)
    """
    np.random.seed(seed)

    if not data_dir:
        data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    os.makedirs(data_dir, exist_ok=True)

    # 1. Historical 90 days ending 2026-10-31
    hist_end_date = datetime.date(2026, 10, 31)
    hist_start_date = hist_end_date - datetime.timedelta(days=89)
    hist_dates = [hist_start_date + datetime.timedelta(days=i) for i in range(90)]

    # 2. Holdout future 14 days (2026-11-01 to 2026-11-14)
    holdout_start_date = datetime.date(2026, 11, 1)
    holdout_dates = [holdout_start_date + datetime.timedelta(days=i) for i in range(14)]

    hist_rows = []
    holdout_rows = []
    anomaly_rows = []

    # Process each ingredient
    for ing in INGREDIENTS_CONFIG:
        # Generate 90 historical days
        for day_idx, d in enumerate(hist_dates):
            d_str = d.strftime("%Y-%m-%d")
            weekday = d.weekday()  # 0=Monday, 6=Sunday
            w_factor = ing["weekday_weights"][weekday]

            # Mild upward trend if configured
            trend = 1.0 + (ing["trend_slope"] * (day_idx / 90.0))
            expected_lam = ing["base_demand"] * w_factor * trend

            is_festival_day = (ing["festival"] and d_str in FESTIVAL_DATES)
            is_spike_day = (ing.get("spike_date") == d_str)

            if is_festival_day:
                lam = expected_lam * FESTIVAL_MULTIPLIER
                units_sold = int(np.random.poisson(lam))
                # Ensure units_sold clearly reflects the 3x spike
                min_tripled = int(expected_lam * 2.5)
                if units_sold < min_tripled:
                    units_sold = min_tripled
                anomaly_rows.append({
                    "date": d_str,
                    "ingredient_id": ing["ingredient_id"],
                    "ingredient_name": ing["ingredient_name"],
                    "anomaly_type": "festival",
                    "multiplier": FESTIVAL_MULTIPLIER,
                    "units_sold": units_sold,
                    "baseline_expected": round(expected_lam, 2),
                    "notes": f"Full Moon Festival spike (tripled demand)"
                })
            elif is_spike_day:
                units_sold = ing["spike_qty"]
                anomaly_rows.append({
                    "date": d_str,
                    "ingredient_id": ing["ingredient_id"],
                    "ingredient_name": ing["ingredient_name"],
                    "anomaly_type": "spike",
                    "multiplier": round(units_sold / max(expected_lam, 0.1), 2),
                    "units_sold": units_sold,
                    "baseline_expected": round(expected_lam, 2),
                    "notes": ing.get("spike_desc", "One-off unlabelled spike")
                })
            else:
                units_sold = int(np.random.poisson(expected_lam))

            # Never negative
            units_sold = max(0, units_sold)

            # Row for sample_sales_data.csv
            row = {
                "date": d_str,
                "ingredient_id": ing["ingredient_id"],
                "ingredient_name": ing["ingredient_name"],
                "category": ing["category"],
                "current_stock": ing["current_stock"],
                "safety_stock": ing["safety_stock"],
                "supplier": ing["supplier"],
                "lead_time_days": ing["lead_time_days"],
                "is_cursed": True if is_festival_day else ing["is_cursed"],
                "units_sold": units_sold
            }
            hist_rows.append(row)

        # Generate 14 holdout future days (continuation of same distribution, no festival/spikes)
        for h_idx, d in enumerate(holdout_dates):
            d_str = d.strftime("%Y-%m-%d")
            weekday = d.weekday()
            w_factor = ing["weekday_weights"][weekday]

            total_day_idx = 90 + h_idx
            trend = 1.0 + (ing["trend_slope"] * (total_day_idx / 90.0))
            expected_lam = ing["base_demand"] * w_factor * trend
            units_sold = max(0, int(np.random.poisson(expected_lam)))

            h_row = {
                "date": d_str,
                "ingredient_id": ing["ingredient_id"],
                "ingredient_name": ing["ingredient_name"],
                "category": ing["category"],
                "current_stock": ing["current_stock"],
                "safety_stock": ing["safety_stock"],
                "supplier": ing["supplier"],
                "lead_time_days": ing["lead_time_days"],
                "is_cursed": ing["is_cursed"],
                "units_sold": units_sold
            }
            holdout_rows.append(h_row)

    # Sort anomaly rows chronologically
    anomaly_rows.sort(key=lambda x: (x["date"], x["ingredient_id"]))

    # Write 1. sample_sales_data.csv
    sample_csv_path = os.path.join(data_dir, "sample_sales_data.csv")
    with open(sample_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(hist_rows)

    # Write 2. holdout_future.csv
    holdout_csv_path = os.path.join(data_dir, "holdout_future.csv")
    with open(holdout_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        writer.writerows(holdout_rows)

    # Write 3. anomaly_labels.csv
    anomaly_csv_path = os.path.join(data_dir, "anomaly_labels.csv")
    with open(anomaly_csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=ANOMALY_FIELDNAMES)
        writer.writeheader()
        writer.writerows(anomaly_rows)

    print(f"Generated {len(hist_rows)} historical rows in: {sample_csv_path}")
    print(f"Generated {len(holdout_rows)} holdout rows in: {holdout_csv_path}")
    print(f"Generated {len(anomaly_rows)} anomaly labels in: {anomaly_csv_path}")

    # Summary Statistics
    print("\n================ DATASET GENERATION SUMMARY ================")
    print(f"{'Ingredient':<18} | {'Stock':<6} | {'Safety':<6} | {'Mean':<6} | {'Std':<6} | {'Min':<4} | {'Max':<4}")
    print("------------------------------------------------------------")
    for ing in INGREDIENTS_CONFIG:
        ing_id = ing["ingredient_id"]
        sales = [r["units_sold"] for r in hist_rows if r["ingredient_id"] == ing_id]
        print(
            f"{ing['ingredient_name']:<18} | "
            f"{ing['current_stock']:<6} | "
            f"{ing['safety_stock']:<6} | "
            f"{np.mean(sales):<6.2f} | "
            f"{np.std(sales):<6.2f} | "
            f"{min(sales):<4} | "
            f"{max(sales):<4}"
        )
    print("============================================================\n")


if __name__ == "__main__":
    generate_all()

