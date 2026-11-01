from __future__ import annotations
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime, timedelta
from ml_engine.ai_core import run_prophecy_and_restock, detect_strange_happenings, generate_forecast
from evaluate import evaluate_csv_content
import firebase_db
import import_sample_data
import os

app = FastAPI(title="The Witch's Potion Pantry API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    firebase_db.seed_firestore_if_empty()
    # When in-memory fallback is active or collection is fresh, automatically load sample data
    sample_file = import_sample_data.find_sample_file()
    if sample_file and os.path.exists(sample_file):
        import_sample_data.import_data(sample_file)

class StockUpdate(BaseModel):
    change_amount: int  # Negative for sale, positive for restock

class AuditRequest(BaseModel):
    missing_amount: int = 5  # Units that vanished during audit

class IngredientCreate(BaseModel):
    name: str
    current_stock: int
    safety_stock: Optional[int] = 10
    supplier: Optional[str] = "Diagon Alley Apothecary"
    lead_time_days: Optional[int] = 3
    unit: Optional[str] = "jars"
    category: Optional[str] = "Potions & Herbs"

class CurseRequest(BaseModel):
    ingredient_ids: list  # Up to 3 ingredients for 3x Full Moon Festival spike
    start_date: Optional[str] = None
    duration_days: Optional[int] = 3
    multiplier: Optional[float] = 3.0

class EventCreate(BaseModel):
    name: str
    ingredient_ids: list
    start_date: str
    end_date: str
    multiplier: float = 3.0

@app.get("/api/pantry")
def get_full_pantry_status():
    items = firebase_db.get_all_ingredients()
    results = []
    today = datetime.now().date()
    today_str = today.strftime("%Y-%m-%d")

    for item in items:
        ing_id = item.get("id")
        sales_history = item.get("sales", [])
        events = firebase_db.get_events_for_ingredient(ing_id)
        is_cursed = firebase_db.is_ingredient_cursed(ing_id)
        current_multiplier = firebase_db.get_event_multiplier_for_date(ing_id, today_str)
        lead_time = int(item.get("lead_time_days") or 3)

        daily_sales = item.get("daily_sales", {})
        ai_metrics = run_prophecy_and_restock(
            sales_history=sales_history,
            current_stock=item.get("current_stock", 0),
            safety_stock=item.get("safety_stock", 0),
            is_cursed=is_cursed,
            events=events,
            lead_time_days=lead_time,
            reference_date=today,
            daily_sales=daily_sales,
            ingredient_id=ing_id
        )
        anomalies = detect_strange_happenings(
            sales_history=sales_history,
            expected_stock=item.get("expected_stock", 0),
            actual_stock=item.get("current_stock", 0),
            current_multiplier=current_multiplier,
            daily_sales=daily_sales
        )
        results.append({
            **item,
            "is_cursed": is_cursed,
            "prophecy": ai_metrics,
            "anomalies": anomalies,
            "events": events
        })
    return {"pantry": results}

@app.post("/api/pantry")
def create_ingredient(payload: IngredientCreate):
    created = firebase_db.add_ingredient(payload.dict())
    return {"status": "created", "item": created}

@app.get("/api/ingredients/{item_id}/history")
def get_ingredient_history(item_id: str, days: int = Query(60, ge=1, le=365)):
    target_id = int(item_id) if item_id.isdigit() else item_id
    history = firebase_db.get_ingredient_sales_history(target_id, days=days)
    if not history:
        raise HTTPException(status_code=404, detail="Ingredient not found or no history available")
    return {"ingredient_id": target_id, "days": days, "history": history}

@app.get("/api/ingredients/{item_id}/forecast")
def get_ingredient_forecast(item_id: str, days: int = Query(14, ge=1, le=90)):
    target_id = int(item_id) if item_id.isdigit() else item_id
    item = firebase_db.get_ingredient(target_id)
    if not item:
        raise HTTPException(status_code=404, detail="Ingredient not found")

    events = firebase_db.get_events_for_ingredient(target_id)
    daily_sales = item.get("daily_sales", {})
    return generate_forecast(
        daily_sales=daily_sales,
        days=days,
        events=events,
        reference_date=datetime.now().date(),
        ingredient_id=target_id
    )

@app.post("/api/pantry/{item_id}/transaction")
def record_transaction(item_id: str, payload: StockUpdate):
    target_id = int(item_id) if item_id.isdigit() else item_id
    updated = firebase_db.update_stock_and_sales(target_id, payload.change_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "updated", "item": updated}

@app.post("/api/pantry/{item_id}/audit")
def audit_shelf(item_id: str, payload: AuditRequest):
    target_id = int(item_id) if item_id.isdigit() else item_id
    updated = firebase_db.audit_stock(target_id, payload.missing_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "audited", "item": updated, "message": f"{payload.missing_amount} units reported missing during shelf audit."}

# =====================================================================
# Events Endpoints
# =====================================================================

@app.post("/api/events")
def create_event(payload: EventCreate):
    event = firebase_db.add_event({
        "name": payload.name,
        "ingredient_ids": payload.ingredient_ids,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "multiplier": payload.multiplier,
    })
    # Update legacy is_cursed for all affected ingredients
    firebase_db.set_cursed_ingredients(payload.ingredient_ids)
    return {"status": "created", "event": event}

@app.get("/api/events")
def list_events():
    return {"events": firebase_db.get_all_events()}

@app.delete("/api/events/{event_id}")
def delete_event(event_id: str):
    success = firebase_db.delete_event(event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"status": "deleted", "id": event_id}

@app.post("/api/midnight-curse")
def trigger_midnight_curse(payload: CurseRequest):
    """
    Shortcut: creates a 'Full Moon Festival' event starting 7 days from today,
    lasting 3 days, with a 3.0 multiplier (or accepts custom parameters in payload).
    """
    start_date = payload.start_date
    if not start_date:
        start_date = (datetime.now().date() + timedelta(days=7)).strftime("%Y-%m-%d")
    duration = payload.duration_days or 3
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    end_date = (start_dt + timedelta(days=duration - 1)).strftime("%Y-%m-%d")
    multiplier = payload.multiplier if payload.multiplier is not None else 3.0

    event = firebase_db.add_event({
        "name": "Full Moon Festival",
        "ingredient_ids": payload.ingredient_ids,
        "start_date": start_date,
        "end_date": end_date,
        "multiplier": multiplier,
    })
    firebase_db.set_cursed_ingredients(payload.ingredient_ids)

    return {
        "status": "Midnight Curse Applied (3x Demand Spike)",
        "cursed_ids": payload.ingredient_ids,
        "event": event
    }

# =====================================================================
# Judge CSV Upload & Evaluation Endpoint
# =====================================================================

@app.post("/api/evaluate-csv")
async def evaluate_csv_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None)
):
    csv_text = ""
    # 1. Check if multipart file was provided
    if file is not None:
        try:
            content_bytes = await file.read()
            csv_text = content_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass

    # 2. Check JSON payload or raw body if file was not provided or empty
    if not csv_text.strip():
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body_json = await request.json()
                csv_text = body_json.get("csv_text") or body_json.get("content") or body_json.get("csv") or ""
            except Exception:
                pass
        if not csv_text.strip():
            try:
                body_bytes = await request.body()
                csv_text = body_bytes.decode("utf-8", errors="replace")
            except Exception:
                pass

    if not csv_text.strip():
        raise HTTPException(
            status_code=400,
            detail="No CSV content found. Upload a file via multipart form or send CSV text in body."
        )

    try:
        report = evaluate_csv_content(csv_text)
        return {"status": "success", "report": report}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to evaluate CSV: {str(e)}")

