import numpy as np
from datetime import datetime, timedelta

def run_prophecy_and_restock(
    sales_history: list[int],
    current_stock: int,
    safety_stock: int,
    is_cursed: bool = False,
    events: list[dict] = None,
    lead_time_days: int = 3,
    reference_date = None
) -> dict:
    """
    Computes EMA daily burn rate, stockout prophecy, crystal ball 7-day forecast with
    event multipliers applied only during active dates, and festival-aware restock recommendations.
    """
    if reference_date is None:
        ref_date = datetime.now().date()
    elif isinstance(reference_date, datetime):
        ref_date = reference_date.date()
    else:
        ref_date = reference_date

    today_str = ref_date.strftime("%Y-%m-%d")

    # 1. Exponential moving average for baseline daily burn rate
    if not sales_history:
        base_demand = 5.0
    else:
        weights = np.exp(np.linspace(-1., 0., len(sales_history)))
        weights /= weights.sum()
        base_demand = float(np.dot(sales_history, weights))

    base_demand = max(round(base_demand, 2), 0.1)

    # 2. Today's active multiplier
    today_mult = 1.0
    if events:
        for evt in events:
            if evt.get("start_date", "") <= today_str <= evt.get("end_date", ""):
                today_mult = max(today_mult, float(evt.get("multiplier", 3.0)))
    elif is_cursed:
        today_mult = 3.0

    daily_demand = max(round(base_demand * today_mult, 2), 0.1)

    # 3. Crystal Ball: 7-day future forecast points (multiplier applied ONLY on event days)
    crystal_ball = []
    for i in range(1, 8):
        day_date = ref_date + timedelta(days=i)
        day_str = day_date.strftime("%Y-%m-%d")
        
        day_mult = 1.0
        if events:
            for evt in events:
                if evt.get("start_date", "") <= day_str <= evt.get("end_date", ""):
                    day_mult = max(day_mult, float(evt.get("multiplier", 3.0)))
        elif is_cursed:
            day_mult = 3.0

        predicted = round(base_demand * day_mult * (1 + 0.05 * np.sin(i)), 1)
        crystal_ball.append({
            "day": f"+{i}d",
            "date": day_str,
            "predicted": predicted
        })

    # 4. Prophecy: Stockout calculation simulating day-by-day consumption
    rem = float(current_stock)
    day_count = 0.0
    for day_offset in range(1, 365):
        d_date = ref_date + timedelta(days=day_offset)
        d_str = d_date.strftime("%Y-%m-%d")
        d_mult = 1.0
        if events:
            for evt in events:
                if evt.get("start_date", "") <= d_str <= evt.get("end_date", ""):
                    d_mult = max(d_mult, float(evt.get("multiplier", 3.0)))
        elif is_cursed:
            d_mult = 3.0

        day_burn = base_demand * d_mult
        if rem <= day_burn:
            day_count += round(rem / max(day_burn, 0.1), 1)
            rem = 0.0
            break
        else:
            rem -= day_burn
            day_count += 1.0

    if rem > 0:
        day_count += round(rem / base_demand, 1)

    days_left = round(day_count, 1)
    run_out_date = (ref_date + timedelta(days=days_left)).strftime("%Y-%m-%d")

    # 5. Restock Spell: Factor in festival if it falls within lead_time_days + 7 days
    horizon_days = lead_time_days + 7
    horizon_end = ref_date + timedelta(days=horizon_days)
    horizon_end_str = horizon_end.strftime("%Y-%m-%d")

    festival_event = None
    if events:
        for evt in events:
            e_start = evt.get("start_date", "")
            e_end = evt.get("end_date", "")
            if e_start <= horizon_end_str and e_end >= today_str:
                festival_event = evt
                break

    if festival_event:
        # Sum normal 7-day demand plus extra surge units across event days in horizon
        extra_surge = 0.0
        for d in range(1, horizon_days + 1):
            d_date = ref_date + timedelta(days=d)
            d_str = d_date.strftime("%Y-%m-%d")
            if festival_event["start_date"] <= d_str <= festival_event["end_date"]:
                mult = float(festival_event.get("multiplier", 3.0))
                extra_surge += base_demand * (mult - 1.0)

        needed_for_period = (base_demand * 7) + extra_surge
        reorder_qty = max(0, int(np.ceil(needed_for_period + safety_stock - current_stock)))

        fest_start_dt = datetime.strptime(festival_event["start_date"], "%Y-%m-%d").date()
        order_by_dt = fest_start_dt - timedelta(days=lead_time_days)
        order_by = order_by_dt.strftime("%Y-%m-%d")

        reason = (
            f"Festival surge: '{festival_event['name']}' ({festival_event['multiplier']}x) "
            f"from {festival_event['start_date']} to {festival_event['end_date']}. "
            f"Includes {round(extra_surge, 1)} extra surge units. "
            f"Order by {order_by} to account for {lead_time_days}-day lead time."
        )
    else:
        needed_for_week = base_demand * 7
        reorder_qty = max(0, int(np.ceil(needed_for_week + safety_stock - current_stock)))
        run_out_dt = ref_date + timedelta(days=days_left)
        order_by_dt = max(ref_date, run_out_dt - timedelta(days=lead_time_days))
        order_by = order_by_dt.strftime("%Y-%m-%d")
        reason = (
            f"Standard restock: normal consumption ({round(base_demand, 1)} units/day) "
            f"with safety buffer of {safety_stock} for {lead_time_days}-day lead time."
        )

    return {
        "daily_burn_rate": daily_demand,
        "days_until_run_out": days_left,
        "run_out_date": run_out_date,
        "recommended_reorder": reorder_qty,
        "order_by": order_by,
        "reason": reason,
        "crystal_ball_forecast": crystal_ball
    }

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
