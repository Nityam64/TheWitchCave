from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from ml_engine.ai_core import run_prophecy_and_restock, detect_strange_happenings

app = FastAPI(title="The Witch's Potion Pantry API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory seeded pantry database for instant hackathon speed
PANTRY_DB = {
    1: {"id": 1, "name": "Bat Wings", "current_stock": 45, "expected_stock": 45, "safety_stock": 20, "is_cursed": False, "sales": [8, 9, 7, 10, 8, 9, 28]},
    2: {"id": 2, "name": "Mandrake Root", "current_stock": 18, "expected_stock": 25, "safety_stock": 15, "is_cursed": False, "sales": [4, 5, 4, 6, 5, 4, 5]},
    3: {"id": 3, "name": "Ghost Pepper", "current_stock": 60, "expected_stock": 60, "safety_stock": 25, "is_cursed": False, "sales": [10, 12, 11, 9, 10, 11, 10]},
    4: {"id": 4, "name": "Newt Eyes", "current_stock": 90, "expected_stock": 90, "safety_stock": 30, "is_cursed": False, "sales": [6, 5, 7, 6, 6, 5, 6]},
}

class StockUpdate(BaseModel):
    change_amount: int  # Negative for sale, positive for restock

class CurseRequest(BaseModel):
    ingredient_ids: list[int]  # Up to 3 ingredients for 3x Full Moon Festival spike

@app.get("/api/pantry")
def get_full_pantry_status():
    results = []
    for item in PANTRY_DB.values():
        ai_metrics = run_prophecy_and_restock(
            item["sales"], item["current_stock"], item["safety_stock"], item["is_cursed"]
        )
        anomalies = detect_strange_happenings(
            item["sales"], item["expected_stock"], item["current_stock"]
        )
        results.append({**item, "prophecy": ai_metrics, "anomalies": anomalies})
    return {"pantry": results}

@app.post("/api/pantry/{item_id}/transaction")
def record_transaction(item_id: int, payload: StockUpdate):
    if item_id not in PANTRY_DB:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    item = PANTRY_DB[item_id]
    item["current_stock"] = max(0, item["current_stock"] + payload.change_amount)
    item["expected_stock"] = item["current_stock"]
    if payload.change_amount < 0:
        item["sales"].append(abs(payload.change_amount))
    return {"status": "updated", "item": item}

@app.post("/api/midnight-curse")
def trigger_midnight_curse(payload: CurseRequest):
    for item in PANTRY_DB.values():
        item["is_cursed"] = item["id"] in payload.ingredient_ids
    return {"status": "Midnight Curse Applied (3x Demand Spike)", "cursed_ids": payload.ingredient_ids}
