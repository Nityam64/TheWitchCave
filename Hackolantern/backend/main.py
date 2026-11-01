from __future__ import annotations
from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Union
from datetime import datetime, timedelta
from ml_engine.ai_core import run_prophecy_and_restock, detect_strange_happenings, generate_forecast
from evaluate import evaluate_csv_content, predict_from_csv, score_predictions
import firebase_db
import import_sample_data
import os
import json

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
    reason: Optional[str] = None
    notes: Optional[str] = None
    type: Optional[str] = None
    supplier_id: Optional[str] = None

class AuditRequest(BaseModel):
    missing_amount: int = 5  # Units that vanished during audit
    reason: Optional[str] = None
    notes: Optional[str] = None

class SaleRequest(BaseModel):
    item_id: Optional[Union[int, str]] = None
    itemId: Optional[Union[int, str]] = None
    quantity: Optional[int] = None
    change_amount: Optional[int] = None
    notes: Optional[str] = None
    reason: Optional[str] = None
    items: Optional[List[dict]] = None

class DeliveryRequest(BaseModel):
    item_id: Optional[Union[int, str]] = None
    itemId: Optional[Union[int, str]] = None
    quantity: Optional[int] = None
    change_amount: Optional[int] = None
    supplier_id: Optional[str] = None
    supplierId: Optional[str] = None
    notes: Optional[str] = None
    reason: Optional[str] = None

class AdjustmentRequest(BaseModel):
    item_id: Optional[Union[int, str]] = None
    itemId: Optional[Union[int, str]] = None
    quantity_delta: Optional[int] = None
    quantityDelta: Optional[int] = None
    change_amount: Optional[int] = None
    reason: Optional[str] = None
    notes: Optional[str] = None

class IngredientCreate(BaseModel):
    name: str
    current_stock: int
    safety_stock: Optional[int] = 10
    supplier: Optional[str] = "Diagon Alley Apothecary"
    supplier_id: Optional[str] = None
    supplierId: Optional[str] = None
    lead_time_days: Optional[int] = 3
    unit: Optional[str] = "jars"
    category: Optional[str] = "Potions & Herbs"

class IngredientUpdate(BaseModel):
    name: Optional[str] = None
    current_stock: Optional[int] = None
    safety_stock: Optional[int] = None
    supplier_id: Optional[str] = None
    supplierId: Optional[str] = None
    supplier: Optional[str] = None
    lead_time_days: Optional[int] = None
    leadTimeDays: Optional[int] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None

class SupplierCreate(BaseModel):
    id: Optional[str] = None
    name: str
    contact: Optional[str] = "Owl Courier Dispatch"
    lead_time_days: Optional[int] = 3
    leadTimeDays: Optional[int] = None
    notes: Optional[str] = ""

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    lead_time_days: Optional[int] = None
    leadTimeDays: Optional[int] = None
    notes: Optional[str] = None

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
            daily_sales=daily_sales,
            events=events,
            ingredient_id=ing_id
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

@app.patch("/api/pantry/{item_id}")
@app.put("/api/pantry/{item_id}")
@app.patch("/api/ingredients/{item_id}")
@app.put("/api/ingredients/{item_id}")
def update_ingredient_endpoint(item_id: str, payload: IngredientUpdate):
    target_id = int(item_id) if item_id.isdigit() else item_id
    updates = payload.dict(exclude_unset=True)
    if "supplierId" in updates and "supplier_id" not in updates:
        updates["supplier_id"] = updates["supplierId"]
    if "leadTimeDays" in updates and "lead_time_days" not in updates:
        updates["lead_time_days"] = updates["leadTimeDays"]
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    updated = firebase_db.update_ingredient(target_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "updated", "item": updated}

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
    reason = payload.reason or payload.notes
    updated = firebase_db.update_stock_and_sales(
        target_id,
        payload.change_amount,
        reason=reason,
        mov_type=payload.type,
        supplier_id=payload.supplier_id
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "updated", "item": updated}

@app.post("/api/pantry/{item_id}/audit")
def audit_shelf(item_id: str, payload: AuditRequest):
    target_id = int(item_id) if item_id.isdigit() else item_id
    reason = payload.reason or payload.notes or f"Shelf audit shrinkage: {payload.missing_amount} units missing"
    updated = firebase_db.audit_stock(target_id, payload.missing_amount, reason=reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "audited", "item": updated, "message": f"{payload.missing_amount} units reported missing during shelf audit."}

# =====================================================================
# Stock Movements Endpoints (Activity Ledger)
# =====================================================================

@app.get("/api/movements")
def get_movements_endpoint(
    item_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    envelope: bool = Query(False)
):
    target_id = None
    if item_id is not None and str(item_id).strip() != "":
        target_id = int(item_id) if str(item_id).strip().isdigit() else str(item_id).strip()
    mov_type = str(type).strip() if type is not None and str(type).strip() != "" else None

    movements = firebase_db.get_movements(item_id=target_id, movement_type=mov_type, limit=limit)
    if envelope:
        return {"movements": movements, "count": len(movements)}
    return movements

@app.post("/api/sales")
@app.post("/api/sale")
def record_sale_route(payload: SaleRequest):
    # Support atomic multi-item batch like db-service.js recordSaleAtomic
    if payload.items:
        updated_items = []
        for line in payload.items:
            t_id = line.get("itemId") or line.get("item_id")
            qty = int(line.get("quantity", 1))
            note = payload.notes or payload.reason or f"Sale of {line.get('itemName', 'ingredient')}"
            up = firebase_db.record_sale(t_id, qty, reason=note)
            if up:
                updated_items.append(up)
        return {"status": "success", "updated_items": updated_items}

    target_id = payload.item_id if payload.item_id is not None else payload.itemId
    if target_id is None:
        raise HTTPException(status_code=400, detail="Missing item_id in request")
    qty = payload.quantity if payload.quantity is not None else abs(payload.change_amount or 1)
    updated = firebase_db.record_sale(target_id, qty, reason=payload.notes or payload.reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

@app.post("/api/pantry/{item_id}/sale")
def record_item_sale(item_id: str, payload: SaleRequest):
    target_id = int(item_id) if item_id.isdigit() else item_id
    qty = payload.quantity if payload.quantity is not None else abs(payload.change_amount or 1)
    updated = firebase_db.record_sale(target_id, qty, reason=payload.notes or payload.reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

@app.post("/api/deliveries")
@app.post("/api/delivery")
def record_delivery_route(payload: DeliveryRequest):
    target_id = payload.item_id if payload.item_id is not None else payload.itemId
    if target_id is None:
        raise HTTPException(status_code=400, detail="Missing item_id in request")
    qty = payload.quantity if payload.quantity is not None else (payload.change_amount or 0)
    sup_id = payload.supplier_id or payload.supplierId
    updated = firebase_db.record_delivery(target_id, qty, supplier_id=sup_id, notes=payload.notes or payload.reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

@app.post("/api/pantry/{item_id}/delivery")
def record_item_delivery(item_id: str, payload: DeliveryRequest):
    target_id = int(item_id) if item_id.isdigit() else item_id
    qty = payload.quantity if payload.quantity is not None else (payload.change_amount or 0)
    sup_id = payload.supplier_id or payload.supplierId
    updated = firebase_db.record_delivery(target_id, qty, supplier_id=sup_id, notes=payload.notes or payload.reason)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

@app.post("/api/adjustments")
@app.post("/api/adjustment")
def record_adjustment_route(payload: AdjustmentRequest):
    target_id = payload.item_id if payload.item_id is not None else payload.itemId
    if target_id is None:
        raise HTTPException(status_code=400, detail="Missing item_id in request")
    delta = payload.quantity_delta if payload.quantity_delta is not None else (payload.quantityDelta if payload.quantityDelta is not None else payload.change_amount)
    if delta is None:
        raise HTTPException(status_code=400, detail="Missing quantity_delta in request")
    updated = firebase_db.record_adjustment(target_id, delta, reason=payload.reason or payload.notes)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

@app.post("/api/pantry/{item_id}/adjustment")
def record_item_adjustment(item_id: str, payload: AdjustmentRequest):
    target_id = int(item_id) if item_id.isdigit() else item_id
    delta = payload.quantity_delta if payload.quantity_delta is not None else (payload.quantityDelta if payload.quantityDelta is not None else payload.change_amount)
    if delta is None:
        raise HTTPException(status_code=400, detail="Missing quantity_delta in request")
    updated = firebase_db.record_adjustment(target_id, delta, reason=payload.reason or payload.notes)
    if not updated:
        raise HTTPException(status_code=404, detail="Ingredient not found")
    return {"status": "success", "item": updated}

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

# =====================================================================
# Judge & Forecasting CSV Prediction & Scoring Endpoints
# =====================================================================

@app.post("/api/predict-csv")
async def predict_csv_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None),
    horizon: int = Query(14, ge=1, le=90),
    format: Optional[str] = Query("json")
):
    csv_text = ""
    # 1. Multipart file upload
    if file is not None:
        try:
            content_bytes = await file.read()
            csv_text = content_bytes.decode("utf-8", errors="replace")
        except Exception:
            pass

    # 2. JSON or form or raw body
    if not csv_text.strip():
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            try:
                body_json = await request.json()
                csv_text = body_json.get("csv_text") or body_json.get("content") or body_json.get("csv") or ""
                if "horizon" in body_json and body_json["horizon"]:
                    horizon = int(body_json["horizon"])
            except Exception:
                pass
        elif "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
            try:
                form = await request.form()
                if "file" in form:
                    form_file = form["file"]
                    if hasattr(form_file, "read"):
                        b = await form_file.read()
                        csv_text = b.decode("utf-8", errors="replace")
                if not csv_text and "csv" in form:
                    csv_text = str(form["csv"])
                if "horizon" in form and form["horizon"]:
                    horizon = int(form["horizon"])
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
            detail="No CSV content found. Upload a history CSV via multipart form or send CSV text in body."
        )

    try:
        result = predict_from_csv(csv_text, horizon=horizon)
        if format.lower() == "csv" or "text/csv" in request.headers.get("accept", ""):
            return Response(
                content=result["csv"],
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=predictions.csv"}
            )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to generate predictions: {str(e)}")

@app.post("/api/score-csv")
async def score_csv_endpoint(
    request: Request,
    predictions_file: Optional[UploadFile] = File(None),
    actuals_file: Optional[UploadFile] = File(None)
):
    preds_text = ""
    actuals_text = ""

    # 1. Check multipart form
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type:
        try:
            form = await request.form()
            # Read predictions file/text
            p_val = predictions_file or form.get("predictions_file") or form.get("predictions") or form.get("preds")
            if p_val is not None:
                if hasattr(p_val, "read"):
                    b = await p_val.read()
                    preds_text = b.decode("utf-8", errors="replace")
                else:
                    preds_text = str(p_val)

            # Read actuals file/text
            a_val = actuals_file or form.get("actuals_file") or form.get("actuals") or form.get("ground_truth")
            if a_val is not None:
                if hasattr(a_val, "read"):
                    b = await a_val.read()
                    actuals_text = b.decode("utf-8", errors="replace")
                else:
                    actuals_text = str(a_val)
        except Exception:
            pass

    # 2. Check JSON payload
    if not preds_text.strip() or not actuals_text.strip():
        if "application/json" in content_type:
            try:
                body_json = await request.json()
                preds_text = preds_text or body_json.get("predictions_csv") or body_json.get("predictions") or body_json.get("preds") or ""
                actuals_text = actuals_text or body_json.get("actuals_csv") or body_json.get("actuals") or body_json.get("ground_truth") or ""
            except Exception:
                pass

    if not preds_text.strip():
        raise HTTPException(status_code=400, detail="Missing predictions CSV. Provide 'predictions' or 'predictions_file'.")
    if not actuals_text.strip():
        raise HTTPException(status_code=400, detail="Missing actuals CSV. Provide 'actuals' or 'actuals_file'.")

    try:
        report = score_predictions(preds_text, actuals_text)
        return report
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to score predictions: {str(e)}")

# =====================================================================
# Health & Status Endpoint
# =====================================================================

@app.get("/api/health")
def get_health_status():
    return {
        "status": "ok",
        "storage": firebase_db.get_active_storage_type(),
        "ingredients": len(firebase_db.get_all_ingredients()),
        "events": len(firebase_db.get_all_events()),
        "server_time": datetime.utcnow().isoformat() + "Z"
    }

@app.get("/api/metrics")
def get_metrics_endpoint():
    config_path = os.path.join(os.path.dirname(__file__), "model_config.json")
    if not os.path.exists(config_path):
        import evaluate
        evaluate.evaluate_models()
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read metrics: {str(e)}")
    raise HTTPException(status_code=404, detail="Model metrics configuration not found")

# =====================================================================
# Supplier Management Endpoints
# =====================================================================

@app.get("/api/suppliers")
def get_suppliers(envelope: bool = Query(False)):
    suppliers = firebase_db.get_all_suppliers(include_ingredients=True)
    if envelope:
        return {"suppliers": suppliers, "count": len(suppliers)}
    return suppliers

@app.get("/api/suppliers/{supplier_id}")
def get_single_supplier(supplier_id: str):
    suppliers = firebase_db.get_all_suppliers(include_ingredients=True)
    for s in suppliers:
        if str(s.get("id")).lower() == str(supplier_id).lower() or str(s.get("name", "")).strip().lower() == str(supplier_id).lower():
            return s
    raise HTTPException(status_code=404, detail="Supplier not found")

@app.post("/api/suppliers", status_code=201)
def create_supplier_endpoint(payload: SupplierCreate):
    data = payload.dict(exclude_unset=True)
    if "leadTimeDays" in data and "lead_time_days" not in data:
        data["lead_time_days"] = data["leadTimeDays"]
    created = firebase_db.add_supplier(data)
    created["ingredients"] = []
    return created

@app.patch("/api/suppliers/{supplier_id}")
@app.put("/api/suppliers/{supplier_id}")
def update_supplier_endpoint(supplier_id: str, payload: SupplierUpdate):
    updates = payload.dict(exclude_unset=True)
    if "leadTimeDays" in updates and "lead_time_days" not in updates:
        updates["lead_time_days"] = updates["leadTimeDays"]
    updated = firebase_db.update_supplier(supplier_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail="Supplier not found")
    all_sups = firebase_db.get_all_suppliers(include_ingredients=True)
    for s in all_sups:
        if str(s.get("id")).lower() == str(supplier_id).lower():
            return s
    return updated

@app.delete("/api/suppliers/{supplier_id}")
def delete_supplier_endpoint(supplier_id: str):
    success, reason, referencing = firebase_db.delete_supplier(supplier_id)
    if not success:
        if reason == "conflict":
            ref_names = ", ".join([f"{item['name']} (ID: {item['id']})" for item in referencing])
            raise HTTPException(
                status_code=409,
                detail=f"Cannot delete supplier '{supplier_id}'. It is still referenced by {len(referencing)} ingredient(s): {ref_names}"
            )
        raise HTTPException(status_code=404, detail="Supplier not found")
    return {"status": "deleted", "id": supplier_id, "message": "Supplier deleted successfully"}

# =====================================================================
# Admin Maintenance Endpoints
# =====================================================================

@app.post("/api/admin/reset-sample-data")
def reset_sample_data_endpoint():
    try:
        sample_file = import_sample_data.find_sample_file()
        count = import_sample_data.import_data(sample_file) if sample_file else import_sample_data.import_data()
        return {
            "status": "ok",
            "message": f"Sample data reset successfully. Processed {count} ingredients.",
            "ingredients": count
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset sample data: {str(e)}")


