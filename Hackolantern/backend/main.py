from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from ml_engine.ai_core import run_prophecy_and_restock, detect_strange_happenings
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

class CurseRequest(BaseModel):
    ingredient_ids: list  # Up to 3 ingredients for 3x Full Moon Festival spike

class EventCreate(BaseModel):
    name: str = "Full Moon Festival"
    start_date: str
    end_date: str
    multiplier: float = 3.0
    affected_ingredients: List[str]

@app.get("/api/pantry")
def get_full_pantry_status():
    items = firebase_db.get_all_ingredients()
    results = []
    today = datetime.now().date()
    today_str = today.strftime("%Y-%m-%d")

    for item in items:
        ing_id = item.get("id")
        # AI engine uses backward-compatible 14-day daily sales list
        sales_history = item.get("sales", [])
        events = firebase_db.get_events_for_ingredient(ing_id)
        is_cursed = firebase_db.is_ingredient_cursed(ing_id) or item.get("is_cursed", False)
        current_multiplier = firebase_db.get_event_multiplier_for_date(ing_id, today_str)
        lead_time = int(item.get("lead_time_days") or 3)

        ai_metrics = run_prophecy_and_restock(
            sales_history=sales_history,
            current_stock=item.get("current_stock", 0),
            safety_stock=item.get("safety_stock", 0),
            is_cursed=is_cursed,
            events=events,
            lead_time_days=lead_time,
            reference_date=today
        )
        anomalies = detect_strange_happenings(
            sales_history=sales_history,
            expected_stock=item.get("expected_stock", 0),
            actual_stock=item.get("current_stock", 0),
            current_multiplier=current_multiplier
        )
        results.append({
            **item,
            "is_cursed": is_cursed,
            "prophecy": ai_metrics,
            "anomalies": anomalies,
            "events": events
        })
    return {"pantry": results}

@app.get("/api/ingredients/{item_id}/history")
def get_ingredient_history(item_id: str, days: int = Query(60, ge=1, le=365)):
    history = firebase_db.get_ingredient_sales_history(item_id, days=days)
    if not history:
        raise HTTPException(status_code=404, detail="Ingredient not found or no history available")
    return {"ingredient_id": item_id, "days": days, "history": history}

@app.post("/api/pantry/{item_id}/transaction")
def record_transaction(item_id: str, payload: StockUpdate):
    updated = firebase_db.update_stock_and_sales(item_id, payload.change_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "updated", "item": updated}

@app.post("/api/pantry/{item_id}/audit")
def audit_shelf(item_id: str, payload: AuditRequest):
    updated = firebase_db.audit_stock(item_id, payload.missing_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "audited", "item": updated, "message": f"{payload.missing_amount} units reported missing during shelf audit."}

@app.post("/api/midnight-curse")
def trigger_midnight_curse(payload: CurseRequest):
    firebase_db.set_cursed_ingredients(payload.ingredient_ids)
    return {"status": "Midnight Curse Applied (3x Demand Spike)", "cursed_ids": payload.ingredient_ids}

@app.post("/api/events")
def create_event_endpoint(payload: EventCreate):
    created = firebase_db.create_event(payload.dict())
    return {"status": "created", "event": created}

@app.get("/api/events")
def list_events_endpoint():
    return {"events": firebase_db.get_all_events()}
