import numpy as np
from datetime import datetime, timedelta

def run_prophecy_and_restock(sales_history: list[int], current_stock: int, safety_stock: int, is_cursed: bool) -> dict:
    # Exponential moving average for daily burn rate
    if not sales_history:
        base_demand = 5.0
    else:
        weights = np.exp(np.linspace(-1., 0., len(sales_history)))
        weights /= weights.sum()
        base_demand = float(np.dot(sales_history, weights))

    # Midnight Curse: 3x demand multiplier for Full Moon Festival
    multiplier = 3.0 if is_cursed else 1.0
    daily_demand = max(round(base_demand * multiplier, 2), 0.1)

    # Prophecy: Stockout calculation
    days_left = round(current_stock / daily_demand, 1)
    run_out_date = (datetime.now() + timedelta(days=days_left)).strftime("%Y-%m-%d")

    # Restock Spell: 7-day lead time + safety stock
    needed_for_week = daily_demand * 7
    reorder_qty = max(0, int(np.ceil(needed_for_week + safety_stock - current_stock)))

    # Crystal Ball: 7-day future forecast points
    crystal_ball = [
        {"day": f"+{i}d", "predicted": round(daily_demand * (1 + 0.05 * np.sin(i)), 1)}
        for i in range(1, 8)
    ]

    return {
        "daily_burn_rate": daily_demand,
        "days_until_run_out": days_left,
        "run_out_date": run_out_date,
        "recommended_reorder": reorder_qty,
        "crystal_ball_forecast": crystal_ball
    }

def detect_strange_happenings(sales_history: list[int], expected_stock: int, actual_stock: int) -> list[str]:
    alerts = []
    # 1. Missing Stock / Shrinkage check
    if actual_stock < expected_stock:
        alerts.append(f"MISSING STOCK: {expected_stock - actual_stock} units vanished without a sale!")

    # 2. Z-Score Consumption Spike check
    if len(sales_history) >= 5:
        baseline = sales_history[:-1]
        mean = np.mean(baseline)
        std = np.std(baseline) or 1.0
        z_score = (sales_history[-1] - mean) / std
        if z_score > 2.0:
            alerts.append(f"CONSUMPTION SPIKE: Latest sale ({sales_history[-1]}) is {round(z_score, 1)}σ above normal ({round(mean, 1)})!")

    return alerts
