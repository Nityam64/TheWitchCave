import os
import json
import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Tuple, Union, Any

CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "model_config.json")

def load_model_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"best_model_overall": "holt_winters", "best_per_ingredient": {}}

# =====================================================================
# Candidate Models
# =====================================================================

def predict_moving_average_7d(daily_series: list[float], steps: int = 14) -> tuple[list[float], float]:
    """
    Candidate Model (a): 7-day moving average.
    Returns: (predictions, residual_std)
    """
    if not daily_series:
        return [5.0] * steps, 1.0

    k = min(7, len(daily_series))
    ma = float(np.mean(daily_series[-k:]))
    preds = [round(max(0.0, ma), 2)] * steps

    # In-sample residual standard deviation
    if len(daily_series) > 1:
        window_slice = daily_series[-max(7, k):]
        residuals = [v - ma for v in window_slice]
        resid_std = float(np.std(residuals)) if len(residuals) > 1 else float(np.std(daily_series))
    else:
        resid_std = 1.0

    return preds, max(round(resid_std, 2), 0.5)

def predict_same_weekday_4w(
    dates: list[str],
    daily_series: list[float],
    future_dates: list[str]
) -> tuple[list[float], float]:
    """
    Candidate Model (b): Same-weekday average over the last 4 weeks (up to 28 days preceding forecast).
    Returns: (predictions, residual_std)
    """
    if not daily_series or not dates:
        return [5.0] * len(future_dates), 1.0

    # Look back over the last 28 days
    cutoff = max(0, len(dates) - 28)
    recent_dates = dates[cutoff:]
    recent_values = daily_series[cutoff:]

    weekday_history: dict[int, list[float]] = {w: [] for w in range(7)}
    for d_str, val in zip(recent_dates, recent_values):
        try:
            dt = datetime.strptime(d_str, "%Y-%m-%d").date()
            weekday_history[dt.weekday()].append(float(val))
        except Exception:
            pass

    fallback_mean = float(np.mean(daily_series[-7:])) if len(daily_series) >= 7 else float(np.mean(daily_series))

    preds = []
    for fd_str in future_dates:
        try:
            f_dt = datetime.strptime(fd_str, "%Y-%m-%d").date()
            w = f_dt.weekday()
            history_for_w = weekday_history.get(w, [])
            val = float(np.mean(history_for_w)) if history_for_w else fallback_mean
        except Exception:
            val = fallback_mean
        preds.append(round(max(0.0, val), 2))

    # In-sample residuals on same-weekday predictions
    diffs = []
    for d_str, actual in zip(recent_dates, recent_values):
        try:
            dt = datetime.strptime(d_str, "%Y-%m-%d").date()
            w_vals = weekday_history.get(dt.weekday(), [])
            exp = float(np.mean(w_vals)) if w_vals else fallback_mean
            diffs.append(actual - exp)
        except Exception:
            pass

    resid_std = float(np.std(diffs)) if len(diffs) > 1 else float(np.std(daily_series))
    return preds, max(round(resid_std, 2), 0.5)

def predict_holt_winters(
    dates: list[str],
    daily_series: list[float],
    future_dates: list[str]
) -> tuple[list[float], float]:
    """
    Candidate Model (c): Holt-Winters exponential smoothing with weekly seasonality (seasonal_periods=7).
    Falls back to Model (b) if len(daily_series) < 21 days or if fitting fails.
    Returns: (predictions, residual_std)
    """
    if len(daily_series) < 21:
        # Fall back to (b) same-weekday average as specified
        return predict_same_weekday_4w(dates, daily_series, future_dates)

    try:
        from statsmodels.tsa.holtwinters import ExponentialSmoothing
        series_arr = np.array(daily_series, dtype=float)
        
        # Fit Holt-Winters with additive trend and seasonal components
        model = ExponentialSmoothing(
            series_arr,
            trend="add",
            seasonal="add",
            seasonal_periods=7,
            initialization_method="estimated"
        )
        fitted = model.fit()
        raw_forecast = fitted.forecast(len(future_dates))
        preds = [round(max(0.0, float(v)), 2) for v in raw_forecast]

        residuals = series_arr - fitted.fittedvalues
        resid_std = float(np.std(residuals))
        return preds, max(round(resid_std, 2), 0.5)
    except Exception:
        # Fall back to same-weekday average if convergence fails
        return predict_same_weekday_4w(dates, daily_series, future_dates)

# =====================================================================
# Forecast Engine & Interval Calculation
# =====================================================================

def generate_forecast(
    daily_sales: dict,
    days: int = 14,
    model_name: Optional[str] = None,
    events: Optional[list] = None,
    reference_date = None,
    ingredient_id: Optional[Union[str, int]] = None
) -> list[dict]:
    """
    Produces [{date, predicted, lower, upper, event}] for `days` horizon.
    Lower and upper come from ±1.96 residual std (95% confidence interval).
    Event multipliers are applied on days matching event start_date..end_date windows.
    """
    if reference_date is None:
        ref_date = datetime.now().date()
    elif isinstance(reference_date, datetime):
        ref_date = reference_date.date()
    else:
        ref_date = reference_date

    # Extract sorted dates and chronological sales
    if daily_sales and isinstance(daily_sales, dict):
        sorted_pairs = sorted(
            [(d, float(v)) for d, v in daily_sales.items() if d],
            key=lambda x: x[0]
        )
        dates = [p[0] for p in sorted_pairs]
        series = [p[1] for p in sorted_pairs]
    else:
        dates = []
        series = []

    # If empty, create fallback history
    if not series:
        series = [5.0] * 14
        dates = [(ref_date - timedelta(days=14 - i)).strftime("%Y-%m-%d") for i in range(14)]

    # Generate future dates
    future_dates = [(ref_date + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(1, days + 1)]

    # Determine model to use
    config = load_model_config()
    chosen_model = model_name
    if not chosen_model and ingredient_id is not None:
        chosen_model = config.get("best_per_ingredient", {}).get(str(ingredient_id))
    if not chosen_model:
        chosen_model = config.get("best_model_overall", "holt_winters")

    # Run chosen model
    if chosen_model == "moving_average_7d":
        baseline_preds, resid_std = predict_moving_average_7d(series, steps=days)
    elif chosen_model == "same_weekday_4w":
        baseline_preds, resid_std = predict_same_weekday_4w(dates, series, future_dates)
    else:
        baseline_preds, resid_std = predict_holt_winters(dates, series, future_dates)

    margin = 1.96 * resid_std

    # Assemble forecast entries with event multipliers
    forecast_results = []
    for fd_str, base_pred in zip(future_dates, baseline_preds):
        multiplier = 1.0
        active_event_name = None

        if events:
            for evt in events:
                e_start = evt.get("start_date", "")
                e_end = evt.get("end_date", "")
                if e_start <= fd_str <= e_end:
                    mult = float(evt.get("multiplier", 3.0))
                    if mult > multiplier:
                        multiplier = mult
                        active_event_name = evt.get("name", "Special Event")

        adj_pred = round(base_pred * multiplier, 2)
        adj_lower = max(0.0, round((base_pred - margin) * multiplier, 2))
        adj_upper = max(0.0, round((base_pred + margin) * multiplier, 2))

        forecast_results.append({
            "date": fd_str,
            "predicted": adj_pred,
            "lower": adj_lower,
            "upper": adj_upper,
            "event": active_event_name
        })

    return forecast_results

# =====================================================================
# Prophecy, Restock & Inventory Math
# =====================================================================

def run_prophecy_and_restock(
    sales_history: list[int],
    current_stock: int,
    safety_stock: int,
    is_cursed: bool = False,
    events: list[dict] = None,
    lead_time_days: int = 3,
    reference_date = None,
    daily_sales: Optional[dict] = None,
    ingredient_id: Optional[Union[str, int]] = None
) -> dict:
    """
    Real evaluated model forecasting + restock math + walk-forward stockout calculation.
    """
    if reference_date is None:
        ref_date = datetime.now().date()
    elif isinstance(reference_date, datetime):
        ref_date = reference_date.date()
    else:
        ref_date = reference_date

    today_str = ref_date.strftime("%Y-%m-%d")
    lead_time = max(1, int(lead_time_days or 3))

    # Prepare daily sales dictionary if not provided
    if not daily_sales and sales_history:
        daily_sales = {
            (ref_date - timedelta(days=len(sales_history) - 1 - i)).strftime("%Y-%m-%d"): val
            for i, val in enumerate(sales_history)
        }

    # Generate at least 14 days or enough to cover lead_time + 7 + festival
    horizon_days = max(14, lead_time + 14)
    forecast_points = generate_forecast(
        daily_sales=daily_sales or {},
        days=horizon_days,
        events=events,
        reference_date=ref_date,
        ingredient_id=ingredient_id
    )

    # 1. Real Crystal Ball: First 7 days of the real evaluated forecast
    crystal_ball = []
    for idx, pt in enumerate(forecast_points[:7]):
        crystal_ball.append({
            "day": f"+{idx + 1}d",
            "date": pt["date"],
            "predicted": pt["predicted"]
        })

    # Today's daily burn rate (baseline from first prediction or historical mean)
    daily_burn = crystal_ball[0]["predicted"] if crystal_ball else 5.0

    # 2. Daily Standard Deviation (σ_daily)
    hist_values = list(daily_sales.values()) if daily_sales else sales_history
    if hist_values and len(hist_values) > 1:
        sigma_daily = float(np.std([float(v) for v in hist_values]))
    else:
        sigma_daily = 2.0
    sigma_daily = max(round(sigma_daily, 2), 0.5)

    # 3. Restock Math (Formula specified in prompt):
    # safety_stock = 1.65 × σ_daily × sqrt(lead_time_days)
    calc_safety_stock = round(1.65 * sigma_daily * np.sqrt(lead_time), 1)

    # reorder_point = forecast demand over the lead time + safety_stock
    lead_time_demand = sum(pt["predicted"] for pt in forecast_points[:lead_time])
    reorder_point = round(lead_time_demand + calc_safety_stock, 1)

    # recommended_reorder = enough to cover lead time + 7 days of forecast demand minus current stock
    coverage_days = lead_time + 7
    coverage_demand = sum(pt["predicted"] for pt in forecast_points[:coverage_days])
    target_inventory = coverage_demand + calc_safety_stock
    reorder_qty = max(0, int(np.ceil(target_inventory - current_stock)))

    # 4. Days-to-Stockout: Walk forward through the day-by-day forecast,
    # subtracting predicted demand until stock hits 0 (taking festival into account)
    rem = float(current_stock)
    days_left = 0.0
    
    # Extend forecast if current stock is very large
    walk_forecast = list(forecast_points)
    if rem > sum(pt["predicted"] for pt in walk_forecast):
        extended_pts = generate_forecast(
            daily_sales=daily_sales or {},
            days=90,
            events=events,
            reference_date=ref_date,
            ingredient_id=ingredient_id
        )
        walk_forecast = extended_pts

    for pt in walk_forecast:
        burn = pt["predicted"]
        if rem <= burn:
            fraction = rem / max(burn, 0.01)
            days_left += fraction
            rem = 0.0
            break
        else:
            rem -= burn
            days_left += 1.0

    if rem > 0:
        last_burn = walk_forecast[-1]["predicted"] if walk_forecast else 5.0
        days_left += rem / max(last_burn, 0.01)

    days_until_run_out = round(days_left, 1)
    run_out_date = (ref_date + timedelta(days=days_until_run_out)).strftime("%Y-%m-%d")

    # 5. Order By & Reason explanation
    # Check if a festival event begins during the coverage window
    active_festival = None
    coverage_end_str = (ref_date + timedelta(days=coverage_days)).strftime("%Y-%m-%d")
    if events:
        for evt in events:
            e_start = evt.get("start_date", "")
            e_end = evt.get("end_date", "")
            if today_str <= e_start <= coverage_end_str or (e_start <= today_str <= e_end):
                active_festival = evt
                break

    if active_festival:
        fest_start = active_festival.get("start_date", today_str)
        try:
            fest_dt = datetime.strptime(fest_start, "%Y-%m-%d").date()
            order_by_dt = fest_dt - timedelta(days=lead_time)
            order_by = max(ref_date, order_by_dt).strftime("%Y-%m-%d")
        except Exception:
            order_by = today_str

        reason = (
            f"Festival surge: '{active_festival['name']}' ({active_festival.get('multiplier', 3.0)}x) "
            f"from {active_festival.get('start_date')} to {active_festival.get('end_date')}. "
            f"Forecast demand over {coverage_days}d is {round(coverage_demand, 1)} units (incl. safety buffer {calc_safety_stock}). "
            f"Order by {order_by} to account for {lead_time}-day lead time."
        )
    else:
        run_out_dt = ref_date + timedelta(days=days_until_run_out)
        order_by_dt = max(ref_date, run_out_dt - timedelta(days=lead_time))
        order_by = order_by_dt.strftime("%Y-%m-%d")
        reason = (
            f"Standard restock: evaluated model forecast demand is {round(coverage_demand, 1)} units over {coverage_days}d. "
            f"Safety stock: {calc_safety_stock} (σ={sigma_daily}, lead={lead_time}d, reorder point={reorder_point})."
        )

    return {
        "daily_burn_rate": daily_burn,
        "days_until_run_out": days_until_run_out,
        "run_out_date": run_out_date,
        "safety_stock": calc_safety_stock,
        "reorder_point": reorder_point,
        "recommended_reorder": reorder_qty,
        "order_by": order_by,
        "reason": reason,
        "crystal_ball_forecast": crystal_ball
    }

# =====================================================================
# Anomaly Detection
# =====================================================================

def detect_strange_happenings(
    sales_history: list[int],
    expected_stock: int,
    actual_stock: int,
    current_multiplier: float = 1.0
) -> list[str]:
    """
    Detects shrinkage (missing stock) and Z-score consumption spikes adjusted for active surge events.
    """
    alerts = []
    # 1. Missing Stock / Shrinkage check
    if actual_stock < expected_stock:
        alerts.append(f"MISSING STOCK: {expected_stock - actual_stock} units vanished without a sale!")

    # 2. Z-Score Consumption Spike check (Event-Adjusted)
    if len(sales_history) >= 5:
        baseline = sales_history[:-1]
        mean = float(np.mean(baseline))
        std = float(np.std(baseline)) or 1.0

        multiplier = max(float(current_multiplier), 1.0)
        expected_sale = mean * multiplier

        z_score = (sales_history[-1] - expected_sale) / std
        if z_score > 2.0:
            alerts.append(
                f"CONSUMPTION SPIKE: Latest sale ({sales_history[-1]}) is {round(z_score, 1)}σ above "
                f"event-adjusted expected ({round(expected_sale, 1)})!"
            )

    return alerts
