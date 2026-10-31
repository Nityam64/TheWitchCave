from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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

@app.get("/api/pantry")
def get_full_pantry_status():
    items = firebase_db.get_all_ingredients()
    results = []
    for item in items:
        # ai engine uses the daily sales list
        sales_history = item.get("sales", [])
        ai_metrics = run_prophecy_and_restock(
            sales_history,
            item.get("current_stock", 0),
            item.get("safety_stock", 0),
            item.get("is_cursed", False)
        )
        anomalies = detect_strange_happenings(
            sales_history,
            item.get("expected_stock", 0),
            item.get("current_stock", 0)
        )
        results.append({**item, "prophecy": ai_metrics, "anomalies": anomalies})
    return {"pantry": results}

@app.get("/api/ingredients/{item_id}/history")
def get_ingredient_history(item_id: str, days: int = Query(60, ge=1, le=365)):
    # Try parsing integer if numeric
    target_id = int(item_id) if item_id.isdigit() else item_id
    history = firebase_db.get_ingredient_sales_history(target_id, days=days)
    if not history:
        raise HTTPException(status_code=404, detail="Ingredient not found or no history available")
    return {"ingredient_id": target_id, "days": days, "history": history}

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

@app.post("/api/midnight-curse")
def trigger_midnight_curse(payload: CurseRequest):
    firebase_db.set_cursed_ingredients(payload.ingredient_ids)
    return {"status": "Midnight Curse Applied (3x Demand Spike)", "cursed_ids": payload.ingredient_ids}
