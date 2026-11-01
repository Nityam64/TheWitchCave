import os
import re
import csv
import glob
import logging
from datetime import datetime, timezone
import firebase_db
from data_loader import load_sales_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("import_sample_data")

def find_sample_file(data_dir=None):
    if not data_dir:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
    if not os.path.exists(data_dir):
        return None
    preferred = os.path.join(data_dir, "sample_sales_data.csv")
    if os.path.exists(preferred):
        return preferred
    candidates = glob.glob(os.path.join(data_dir, "*.csv")) + glob.glob(os.path.join(data_dir, "*.json"))
    for c in candidates:
        basename = os.path.basename(c).lower()
        if "holdout" not in basename and "anomaly" not in basename:
            return c
    return candidates[0] if candidates else None

def inspect_file(filepath):
    """Prints columns and first 10 rows."""
    print(f"\n--- Inspecting sample file: {filepath} ---")
    if filepath.endswith(".csv"):
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            print("Columns:", header)
            print("First 10 rows:")
            for i in range(10):
                row = next(reader, None)
                if row is None:
                    break
                print(f"Row {i+1}:", row)
    print("------------------------------------------\n")

def resolve_target_id(name: str, raw_id: str, db: dict, in_progress: dict) -> int:
    """Matches existing ingredient by slug, id or name; generates next integer ID for new ones."""
    norm_name = name.strip().lower()
    norm_id = str(raw_id).strip().lower()

    # Check already registered in this import batch
    for k, v in in_progress.items():
        if str(v.get("slug", "")).lower() == norm_id:
            return k
        if v.get("name", "").strip().lower() == norm_name:
            return k

    # Check existing items in database
    for k, v in db.items():
        if str(k).lower() == norm_id or str(v.get("id")).lower() == norm_id:
            return k
        if str(v.get("slug", "")).lower() == norm_id:
            return k
        if v.get("name", "").strip().lower() == norm_name:
            return k

    # Assign next integer ID considering both db and in_progress
    all_keys = list(db.keys()) + list(in_progress.keys())
    int_ids = [int(k) for k in all_keys if str(k).isdigit()]
    return max(int_ids, default=0) + 1

def import_data(filepath=None):
    if not filepath:
        filepath = find_sample_file()
    if not filepath or not os.path.exists(filepath):
        logger.warning("No sample data file found in backend/data/")
        return 0

    inspect_file(filepath)

    imported_count = 0
    ingredients_map = {}
    movements_map = {}
    suppliers_map = {}

    df = load_sales_data(filepath)
    for row in df.to_dict("records"):
        raw_id = row.get("ingredient_id")
        name = row.get("ingredient_name") or str(raw_id)
        if not raw_id:
            raw_id = name.lower().replace(" ", "_")

        supplier = row.get("supplier") or "General Supplier"
        days = int(row.get("lead_time_days") or 3)
        sup_slug = re.sub(r'[^a-z0-9]+', '-', re.sub(r"['\"]", "", str(supplier).lower())).strip('-')
        sup_id = f"sup-{sup_slug}" if sup_slug else "sup-general"

        if sup_id not in suppliers_map:
            suppliers_map[sup_id] = {
                "id": sup_id,
                "name": supplier,
                "contact": f"Owl Courier Dispatch ({supplier})",
                "lead_time_days": days,
                "leadTimeDays": days,
                "notes": f"Primary supplier for {name}"
            }

        # Resolve to persistent ID matching existing database or assigning new
        ing_id = resolve_target_id(name, raw_id, firebase_db._in_memory_db, ingredients_map)

        if ing_id not in ingredients_map:
            stock = int(row.get("current_stock") or 50)
            safety = int(row.get("safety_stock") or 20)
            is_cursed = bool(row.get("is_cursed", False))
            cat = row.get("category") or "General"

            ingredients_map[ing_id] = {
                "id": ing_id,
                "slug": str(raw_id).lower(),
                "name": name,
                "category": cat,
                "current_stock": stock,
                "expected_stock": stock,
                "safety_stock": safety,
                "supplier_id": sup_id,
                "supplier": supplier,
                "lead_time_days": days,
                "is_cursed": is_cursed,
                "daily_sales": {}
            }

        date_str = str(row.get("date"))
        units_sold = int(row.get("units_sold") or 0)
        if date_str:
            curr = ingredients_map[ing_id]["daily_sales"].get(date_str, 0)
            ingredients_map[ing_id]["daily_sales"][date_str] = curr + units_sold

            # Create idempotent historical "sale" movement record per ingredient per day
            mov_id = f"mov-sale-{ing_id}-{date_str}"
            movements_map[mov_id] = {
                "id": mov_id,
                "item_id": ing_id,
                "item_name": name,
                "type": "sale",
                "quantity_delta": -units_sold,
                "resulting_stock": int(row.get("current_stock") or 50),
                "reason": f"Daily potion sales ({units_sold} units)",
                "timestamp": f"{date_str}T18:00:00Z"
            }

    # Save to MongoDB, Firestore, or in-memory
    if firebase_db._mongo_db is not None:
        coll = firebase_db._mongo_db["pantry_ingredients"]
        for ing_id, item in ingredients_map.items():
            doc_id = str(ing_id)
            doc_data = dict(item)
            doc_data["_id"] = doc_id
            existing = coll.find_one({"_id": doc_id})
            if existing:
                merged_daily = dict(existing.get("daily_sales", {}))
                merged_daily.update(item["daily_sales"])
                coll.update_one(
                    {"_id": doc_id},
                    {"$set": {
                        "daily_sales": merged_daily,
                        "updated_at": datetime.utcnow().isoformat() + "Z"
                    }}
                )
            else:
                coll.insert_one(doc_data)

            # Sync sales history to matching core item if numeric ID exists with same name
            for existing_item in coll.find({}):
                if existing_item.get("name", "").lower() == item["name"].lower():
                    merged = dict(existing_item.get("daily_sales", {}))
                    merged.update(item["daily_sales"])
                    coll.update_one(
                        {"_id": existing_item["_id"]},
                        {"$set": {"daily_sales": merged}}
                    )

            imported_count += 1
        logger.info(f"Imported {imported_count} ingredients into MongoDB Atlas.")
    elif firebase_db._firestore_db:
        coll = firebase_db._firestore_db.collection("pantry_ingredients")
        now_iso = datetime.now(timezone.utc).isoformat()
        for ing_id, item in ingredients_map.items():
            doc_ref = coll.document(str(ing_id))
            doc = doc_ref.get()
            if doc.exists:
                existing_data = doc.to_dict()
                merged_daily = dict(existing_data.get("daily_sales", {}))
                merged_daily.update(item["daily_sales"])
                doc_ref.update({
                    "daily_sales": merged_daily,
                    "slug": item["slug"],
                    "category": item["category"],
                    "supplier_id": item["supplier_id"],
                    "supplier": item["supplier"],
                    "lead_time_days": item["lead_time_days"],
                    "updated_at": now_iso
                })
            else:
                doc_ref.set(item)
            imported_count += 1
        logger.info(f"Imported {imported_count} ingredients into Firestore.")
    else:
        # In-memory store
        for ing_id, item in ingredients_map.items():
            if ing_id in firebase_db._in_memory_db:
                firebase_db._in_memory_db[ing_id]["daily_sales"].update(item["daily_sales"])
                firebase_db._in_memory_db[ing_id]["slug"] = item["slug"]
                firebase_db._in_memory_db[ing_id]["category"] = item["category"]
                firebase_db._in_memory_db[ing_id]["supplier_id"] = item["supplier_id"]
                firebase_db._in_memory_db[ing_id]["supplier"] = item["supplier"]
                firebase_db._in_memory_db[ing_id]["lead_time_days"] = item["lead_time_days"]
                firebase_db._in_memory_db[ing_id]["current_stock"] = item["current_stock"]
                firebase_db._in_memory_db[ing_id]["expected_stock"] = item["expected_stock"]
                firebase_db._in_memory_db[ing_id]["safety_stock"] = item["safety_stock"]
            else:
                firebase_db._in_memory_db[ing_id] = item

            # Also sync sales history to matching core item if numeric ID exists with same name
            for existing_id, existing_item in list(firebase_db._in_memory_db.items()):
                if existing_item.get("name", "").lower() == item["name"].lower():
                    existing_item["daily_sales"].update(item["daily_sales"])
                    existing_item["supplier_id"] = item["supplier_id"]
                    existing_item["supplier"] = item["supplier"]
                    existing_item["lead_time_days"] = item["lead_time_days"]
                    existing_item["current_stock"] = item["current_stock"]
                    existing_item["expected_stock"] = item["expected_stock"]
                    existing_item["safety_stock"] = item["safety_stock"]

            imported_count += 1
        logger.info(f"Imported {imported_count} ingredients into in-memory database.")

    # Idempotently record historical stock movements
    mov_imported = 0
    for mov in movements_map.values():
        firebase_db.record_movement(
            item_id=mov["item_id"],
            item_name=mov["item_name"],
            mov_type=mov["type"],
            quantity_delta=mov["quantity_delta"],
            resulting_stock=mov["resulting_stock"],
            reason=mov["reason"],
            timestamp=mov["timestamp"],
            movement_id=mov["id"]
        )
        mov_imported += 1
    logger.info(f"Recorded {mov_imported} historical stock movements.")

    # Idempotently seed suppliers from sample data
    sup_imported = 0
    for sup in suppliers_map.values():
        firebase_db.add_supplier(sup)
        sup_imported += 1
    logger.info(f"Seeded {sup_imported} suppliers from sample data.")

    return imported_count

if __name__ == "__main__":
    count = import_data()
    print(f"Successfully processed and imported {count} ingredients.")
