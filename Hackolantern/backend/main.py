from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ml_engine.ai_core import run_prophecy_and_restock, detect_strange_happenings
import firebase_db

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

class StockUpdate(BaseModel):
    change_amount: int  # Negative for sale, positive for restock

class AuditRequest(BaseModel):
    missing_amount: int = 5  # Units that vanished during audit

class CurseRequest(BaseModel):
    ingredient_ids: list[int]  # Up to 3 ingredients for 3x Full Moon Festival spike

@app.get("/api/pantry")
def get_full_pantry_status():
    items = firebase_db.get_all_ingredients()
    results = []
    for item in items:
        ai_metrics = run_prophecy_and_restock(
            item.get("sales", []),
            item.get("current_stock", 0),
            item.get("safety_stock", 0),
            item.get("is_cursed", False)
        )
        anomalies = detect_strange_happenings(
            item.get("sales", []),
            item.get("expected_stock", 0),
            item.get("current_stock", 0)
        )
        results.append({**item, "prophecy": ai_metrics, "anomalies": anomalies})
    return {"pantry": results}

@app.post("/api/pantry/{item_id}/transaction")
def record_transaction(item_id: int, payload: StockUpdate):
    updated = firebase_db.update_stock_and_sales(item_id, payload.change_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "updated", "item": updated}

@app.post("/api/pantry/{item_id}/audit")
def audit_shelf(item_id: int, payload: AuditRequest):
    updated = firebase_db.audit_stock(item_id, payload.missing_amount)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "audited", "item": updated, "message": f"{payload.missing_amount} units reported missing during shelf audit."}

@app.post("/api/midnight-curse")
def trigger_midnight_curse(payload: CurseRequest):
    firebase_db.set_cursed_ingredients(payload.ingredient_ids)
    return {"status": "Midnight Curse Applied (3x Demand Spike)", "cursed_ids": payload.ingredient_ids}
