import os
import csv
import glob
import logging
from datetime import datetime
import firebase_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("import_sample_data")

def find_sample_file(data_dir=None):
    if not data_dir:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
    if not os.path.exists(data_dir):
        return None
    # Look for any csv or json in data/
    candidates = glob.glob(os.path.join(data_dir, "*.csv")) + glob.glob(os.path.join(data_dir, "*.json"))
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

def import_data(filepath=None):
    if not filepath:
        filepath = find_sample_file()
    if not filepath or not os.path.exists(filepath):
        logger.warning("No sample data file found in backend/data/")
        return 0

    inspect_file(filepath)

    imported_count = 0
    # Group rows by ingredient
    ingredients_map = {}

    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Normalize keys to lower case
            clean_row = {k.strip().lower(): v.strip() for k, v in row.items() if k}
            
            # Identify ingredient ID
            raw_id = clean_row.get("ingredient_id") or clean_row.get("id") or clean_row.get("ingredient")
            name = clean_row.get("ingredient_name") or clean_row.get("name") or str(raw_id)
            if not raw_id:
                raw_id = name.lower().replace(" ", "_")
            
            # Try parsing integer id if possible
            try:
                ing_id = int(raw_id)
            except ValueError:
                ing_id = raw_id

            if ing_id not in ingredients_map:
                # sensible defaults
                stock = int(clean_row.get("current_stock") or 50)
                safety = int(clean_row.get("safety_stock") or 20)
                is_cursed = clean_row.get("is_cursed", "").lower() in ("true", "1", "yes")
                cat = clean_row.get("category") or "General"
                supplier = clean_row.get("supplier") or "General Supplier"
                days = int(clean_row.get("lead_time_days") or clean_row.get("days") or 3)

                ingredients_map[ing_id] = {
                    "id": ing_id,
                    "name": name,
                    "category": cat,
                    "current_stock": stock,
                    "expected_stock": stock,
                    "safety_stock": safety,
                    "supplier": supplier,
                    "lead_time_days": days,
                    "is_cursed": is_cursed,
                    "daily_sales": {}
                }

            # Daily sales record
            date_str = clean_row.get("date")
            units_sold = int(clean_row.get("units_sold") or clean_row.get("quantity") or clean_row.get("qty") or 0)
            if date_str:
                curr = ingredients_map[ing_id]["daily_sales"].get(date_str, 0)
                ingredients_map[ing_id]["daily_sales"][date_str] = curr + units_sold

    # Save to Firestore or in-memory
    if firebase_db._firestore_db:
        coll = firebase_db._firestore_db.collection("pantry_ingredients")
        for ing_id, item in ingredients_map.items():
            doc_ref = coll.document(str(ing_id))
            doc = doc_ref.get()
            if doc.exists:
                # Merge daily sales into existing
                existing_data = doc.to_dict()
                merged_daily = dict(existing_data.get("daily_sales", {}))
                merged_daily.update(item["daily_sales"])
                doc_ref.update({
                    "daily_sales": merged_daily,
                    "updated_at": datetime.utcnow().isoformat() + "Z"
                })
            else:
                doc_ref.set(item)
            imported_count += 1
        logger.info(f"Imported {imported_count} ingredients into Firestore.")
    else:
        # In-memory
        for ing_id, item in ingredients_map.items():
            if ing_id in firebase_db._in_memory_db:
                firebase_db._in_memory_db[ing_id]["daily_sales"].update(item["daily_sales"])
            else:
                firebase_db._in_memory_db[ing_id] = item
            imported_count += 1
        logger.info(f"Imported {imported_count} ingredients into in-memory database.")

    return imported_count

if __name__ == "__main__":
    count = import_data()
    print(f"Successfully processed and imported {count} ingredients.")
