from __future__ import annotations
import os
import re
import uuid
import logging
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("firebase_db")

CORE_SUPPLIERS = [
    {
        "id": "sup-crows-corner",
        "name": "Crow's Corner",
        "contact": "Raven Owl Dispatch #01",
        "lead_time_days": 4,
        "leadTimeDays": 4,
        "notes": "Preserved nocturnal fauna, bat parts, and dried moorland herbs."
    },
    {
        "id": "sup-silver-vale",
        "name": "Silver Vale",
        "contact": "Moon Courier #02",
        "lead_time_days": 3,
        "leadTimeDays": 3,
        "notes": "High-altitude cliff roots and moonpetal botanical essences."
    },
    {
        "id": "sup-moon-market",
        "name": "Moon Market",
        "contact": "Shadow Post #03",
        "lead_time_days": 2,
        "leadTimeDays": 2,
        "notes": "Pungent ghost peppers and nocturnal volcanic minerals."
    },
    {
        "id": "sup-swamp-den",
        "name": "Swamp Den",
        "contact": "Marsh Courier #04",
        "lead_time_days": 5,
        "leadTimeDays": 5,
        "notes": "Amphibian ocular specimens, marsh herbs, and preserved newt eyes."
    },
    {
        "id": "sup-hollow-hive",
        "name": "Hollow Hive",
        "contact": "Broomstick Express #05",
        "lead_time_days": 2,
        "leadTimeDays": 2,
        "notes": "Distilled cave honeys and subterranean sweet nectar."
    },
    {
        "id": "sup-greenhollow",
        "name": "Greenhollow",
        "contact": "Fast Pegasus Post #06",
        "lead_time_days": 1,
        "leadTimeDays": 1,
        "notes": "Freshly harvested mountain rose roots and living flora."
    }
]

CORE_INGREDIENTS = [
    {
        "id": 1,
        "name": "Bat Wings",
        "current_stock": 45,
        "expected_stock": 45,
        "safety_stock": 20,
        "lead_time_days": 4,
        "supplier_id": "sup-crows-corner",
        "supplier": "Crow's Corner",
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 2,
        "name": "Mandrake Root",
        "current_stock": 18,
        "expected_stock": 25,
        "safety_stock": 15,
        "lead_time_days": 3,
        "supplier_id": "sup-silver-vale",
        "supplier": "Silver Vale",
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 3,
        "name": "Ghost Pepper",
        "current_stock": 60,
        "expected_stock": 60,
        "safety_stock": 25,
        "lead_time_days": 2,
        "supplier_id": "sup-moon-market",
        "supplier": "Moon Market",
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 4,
        "name": "Newt Eyes",
        "current_stock": 90,
        "expected_stock": 90,
        "safety_stock": 30,
        "lead_time_days": 5,
        "supplier_id": "sup-swamp-den",
        "supplier": "Swamp Den",
        "is_cursed": False,
        "daily_sales": {}
    },
]

# Helper to populate default 14-day history for core ingredients
_default_patterns = {
    1: [8, 9, 7, 10, 8, 9, 28, 8, 9, 7, 10, 8, 9, 28],
    2: [4, 5, 4, 6, 5, 4, 5, 4, 5, 4, 6, 5, 4, 5],
    3: [10, 12, 11, 9, 10, 11, 10, 10, 12, 11, 9, 10, 11, 10],
    4: [6, 5, 7, 6, 6, 5, 6, 6, 5, 7, 6, 6, 5, 6],
}
_today = datetime.now().date()
for item in CORE_INGREDIENTS:
    pattern = _default_patterns.get(item["id"], [5] * 14)
    item["daily_sales"] = {
        (_today - timedelta(days=13 - idx)).strftime("%Y-%m-%d"): val
        for idx, val in enumerate(pattern)
    }

# In-memory fallback
_in_memory_db = {item["id"]: dict(item, daily_sales=dict(item["daily_sales"])) for item in CORE_INGREDIENTS}
_in_memory_transactions = []
_in_memory_events = {}
_in_memory_movements = {}
_in_memory_suppliers = {s["id"]: dict(s) for s in CORE_SUPPLIERS}

# Backend Database Connections
_firestore_db = None
_mongo_client = None
_mongo_db = None

def init_databases():
    global _firestore_db, _mongo_client, _mongo_db

    # 1. Try MongoDB Atlas if MONGODB_URI is provided
    mongodb_uri = os.environ.get("MONGODB_URI")
    if not mongodb_uri:
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("MONGODB_URI="):
                            mongodb_uri = line.split("=", 1)[1].strip().strip('"').strip("'")
                            break
            except Exception:
                pass

    if mongodb_uri:
        if "<db_password>" in mongodb_uri:
            logger.info("MONGODB_URI configured but contains '<db_password>'. Please set your real database password in .env to activate MongoDB Atlas. (Currently running with in-memory DB fallback).")
        else:
            try:
                import pymongo
                _mongo_client = pymongo.MongoClient(mongodb_uri, serverSelectionTimeoutMS=4000)
                _mongo_client.admin.command("ping")
                db_name = "potion_pantry"
                try:
                    parsed_db = pymongo.uri_parser.parse_uri(mongodb_uri).get("database")
                    if parsed_db:
                        db_name = parsed_db
                except Exception:
                    pass
                _mongo_db = _mongo_client[db_name]
                logger.info(f"✨ Successfully connected to MongoDB Atlas database: '{db_name}'")
            except Exception as e:
                logger.warning(f"Failed to connect to MongoDB Atlas ({e}). Falling back to Firestore/In-Memory.")
                _mongo_client = None
                _mongo_db = None

    # 2. Try Firebase Firestore if MongoDB is not active
    if not _mongo_db:
        creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
        if not creds_path:
            local_creds = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
            if os.path.exists(local_creds):
                creds_path = local_creds

        if creds_path and os.path.exists(creds_path):
            try:
                import firebase_admin  # type: ignore
                from firebase_admin import credentials, firestore  # type: ignore

                if not firebase_admin._apps:
                    cred = credentials.Certificate(creds_path)
                    firebase_admin.initialize_app(cred)
                _firestore_db = firestore.client()
                logger.info(f"Connected to Firebase Firestore using credentials at: {creds_path}")
            except Exception as e:
                logger.warning(f"Failed to initialize Firebase Admin SDK ({e}). Falling back to in-memory store.")
                _firestore_db = None
        else:
            if not mongodb_uri or "<db_password>" in mongodb_uri:
                logger.info("Running with thread-safe in-memory DB fallback (automatic sample data seeding active).")

init_databases()

def _clean_mongo_doc(doc: dict) -> dict:
    """Strips MongoDB ObjectId and formats id."""
    if not doc:
        return doc
    clean = dict(doc)
    if "_id" in clean:
        raw_id = str(clean.pop("_id"))
        if "id" not in clean:
            clean["id"] = int(raw_id) if raw_id.isdigit() else raw_id
    return clean

def get_last_14_days_sales(daily_sales: dict) -> list[int]:
    """Returns a list of the last 14 daily totals in chronological date order (fills missing days with 0)."""
    today = datetime.now().date()
    sales_list = []
    for i in range(13, -1, -1):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        sales_list.append(int(daily_sales.get(d_str, 0)))
    return sales_list

def get_active_storage_type() -> str:
    global _mongo_db, _firestore_db
    if _mongo_db is not None:
        return "mongodb"
    if _firestore_db is not None:
        return "firestore"
    return "memory"

def get_raw_ingredients() -> list[dict]:
    """Fetches raw ingredient documents without resolving supplier links to avoid circular recursion."""
    global _mongo_db, _firestore_db, _in_memory_db
    if _mongo_db is not None:
        try:
            return [_clean_mongo_doc(d) for d in _mongo_db["pantry_ingredients"].find({})]
        except Exception:
            pass
    if _firestore_db is not None:
        try:
            raw = []
            for doc in _firestore_db.collection("pantry_ingredients").stream():
                d = doc.to_dict()
                if "id" not in d:
                    d["id"] = int(doc.id) if doc.id.isdigit() else doc.id
                raw.append(d)
            return raw
        except Exception:
            pass
    return [dict(v) for v in _in_memory_db.values()]

def get_all_suppliers(include_ingredients: bool = True) -> list[dict]:
    """Fetches all suppliers, each optionally enriched with the list of ingredients it supplies."""
    global _mongo_db, _firestore_db, _in_memory_suppliers
    suppliers = []

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["suppliers"]
            for doc in coll.find({}):
                suppliers.append(_clean_mongo_doc(doc))
        except Exception as e:
            logger.error(f"MongoDB get_all_suppliers failed: {e}")

    # 2. Firestore
    elif _firestore_db:
        try:
            coll = _firestore_db.collection("suppliers")
            for doc in coll.stream():
                d = doc.to_dict()
                if "id" not in d:
                    d["id"] = doc.id
                suppliers.append(d)
        except Exception as e:
            logger.error(f"Firestore get_all_suppliers failed: {e}")

    # 3. In-Memory
    else:
        suppliers = [dict(s) for s in _in_memory_suppliers.values()]

    for s in suppliers:
        if "lead_time_days" in s and "leadTimeDays" not in s:
            s["leadTimeDays"] = s["lead_time_days"]
        if "leadTimeDays" in s and "lead_time_days" not in s:
            s["lead_time_days"] = s["leadTimeDays"]

    suppliers.sort(key=lambda x: str(x.get("name", "")))

    if include_ingredients:
        raw_items = get_raw_ingredients()
        for s in suppliers:
            s_id = str(s.get("id", "")).lower()
            s_name = str(s.get("name", "")).lower()
            supplies = []
            for item in raw_items:
                i_sup_id = str(item.get("supplier_id", "")).lower()
                i_sup_name = str(item.get("supplier", "")).lower()
                if (i_sup_id and i_sup_id == s_id) or (i_sup_name and i_sup_name == s_name):
                    supplies.append({
                        "id": item["id"],
                        "name": item.get("name", f"Item {item['id']}")
                    })
            s["ingredients"] = supplies

    return suppliers

def get_supplier(supplier_id: str) -> Optional[dict]:
    """Finds a supplier by ID, slug, or exact name."""
    s_id = str(supplier_id).strip().lower()
    all_sups = get_all_suppliers(include_ingredients=False)
    for s in all_sups:
        if str(s.get("id")).lower() == s_id or str(s.get("name", "")).strip().lower() == s_id:
            return s
    return None

def get_supplier_for_ingredient(item: dict) -> Optional[dict]:
    """Finds the supplier linked to an ingredient document."""
    sup_id = item.get("supplier_id")
    sup_name = item.get("supplier")
    sups = get_all_suppliers(include_ingredients=False)

    if sup_id:
        s_id = str(sup_id).strip().lower()
        for s in sups:
            if str(s.get("id")).lower() == s_id:
                return s

    if sup_name:
        s_name = str(sup_name).strip().lower()
        for s in sups:
            if str(s.get("name", "")).strip().lower() == s_name or str(s.get("id", "")).strip().lower() == s_name:
                return s

    return None

def add_supplier(payload: dict) -> dict:
    """Adds a new supplier or updates an existing one by ID."""
    global _mongo_db, _firestore_db, _in_memory_suppliers
    name = str(payload.get("name", "")).strip() or "General Supplier"
    sup_id = payload.get("id")
    if not sup_id:
        slug = re.sub(r'[^a-z0-9]+', '-', re.sub(r"['\"]", "", name.lower())).strip('-')
        sup_id = f"sup-{slug}" if slug else f"sup-{uuid.uuid4().hex[:6]}"
    sup_id = str(sup_id)

    lead_time = int(payload.get("lead_time_days") if payload.get("lead_time_days") is not None else payload.get("leadTimeDays", 3))
    contact = str(payload.get("contact") or "Owl Courier Dispatch")
    notes = str(payload.get("notes") or "")

    supplier_data = {
        "id": sup_id,
        "name": name,
        "contact": contact,
        "lead_time_days": lead_time,
        "leadTimeDays": lead_time,
        "notes": notes,
        "updated_at": datetime.utcnow().isoformat() + "Z"
    }

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["suppliers"]
            doc = dict(supplier_data, _id=sup_id)
            coll.replace_one({"_id": sup_id}, doc, upsert=True)
        except Exception as e:
            logger.error(f"MongoDB add_supplier failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("suppliers").document(sup_id).set(supplier_data)
        except Exception as e:
            logger.error(f"Firestore add_supplier failed: {e}")

    # 3. In-Memory
    _in_memory_suppliers[sup_id] = supplier_data
    return supplier_data

def update_supplier(supplier_id: str, updates: dict) -> Optional[dict]:
    """Updates supplier fields. Editing lead_time_days automatically flows into ingredient restock math."""
    global _mongo_db, _firestore_db, _in_memory_suppliers
    sup = get_supplier(supplier_id)
    if not sup:
        return None

    clean_updates = dict(updates)
    if "leadTimeDays" in clean_updates and "lead_time_days" not in clean_updates:
        clean_updates["lead_time_days"] = clean_updates["leadTimeDays"]
    if "lead_time_days" in clean_updates:
        clean_updates["lead_time_days"] = int(clean_updates["lead_time_days"])
        clean_updates["leadTimeDays"] = int(clean_updates["lead_time_days"])

    clean_updates["updated_at"] = datetime.utcnow().isoformat() + "Z"

    s_id = str(sup["id"])
    sup.update(clean_updates)

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            _mongo_db["suppliers"].replace_one({"_id": s_id}, dict(sup, _id=s_id), upsert=True)
        except Exception as e:
            logger.error(f"MongoDB update_supplier failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("suppliers").document(s_id).set(sup)
        except Exception as e:
            logger.error(f"Firestore update_supplier failed: {e}")

    # 3. In-Memory
    _in_memory_suppliers[s_id] = sup
    return sup

def delete_supplier(supplier_id: str) -> tuple[bool, str, list]:
    """Deletes a supplier. Returns 409 conflict if ingredients still reference it."""
    global _mongo_db, _firestore_db, _in_memory_suppliers
    sup = get_supplier(supplier_id)
    if not sup:
        return False, "not_found", []

    s_id = str(sup["id"]).lower()
    s_name = str(sup["name"]).lower()

    # Check referencing ingredients
    raw_items = get_raw_ingredients()
    referencing = []
    for item in raw_items:
        i_sup_id = str(item.get("supplier_id", "")).lower()
        i_sup_name = str(item.get("supplier", "")).lower()
        if (i_sup_id and i_sup_id == s_id) or (i_sup_name and i_sup_name == s_name):
            referencing.append({"id": item["id"], "name": item.get("name", f"Item {item['id']}")})

    if referencing:
        return False, "conflict", referencing

    real_id = str(sup["id"])
    # 1. MongoDB
    if _mongo_db is not None:
        try:
            _mongo_db["suppliers"].delete_one({"$or": [{"_id": real_id}, {"id": real_id}]})
        except Exception as e:
            logger.error(f"MongoDB delete_supplier failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("suppliers").document(real_id).delete()
        except Exception as e:
            logger.error(f"Firestore delete_supplier failed: {e}")

    # 3. In-Memory
    if real_id in _in_memory_suppliers:
        del _in_memory_suppliers[real_id]

    return True, "deleted", []

def _enrich_ingredient_with_supplier(item: dict) -> dict:
    """Enriches ingredient document by deriving lead_time_days and supplier info from linked supplier entity."""
    if not item:
        return item
    sup = get_supplier_for_ingredient(item)
    if sup:
        item["supplier_id"] = sup["id"]
        item["supplier"] = sup["name"]
        lt = sup.get("lead_time_days")
        if lt is None:
            lt = sup.get("leadTimeDays", 3)
        item["lead_time_days"] = int(lt)
    elif "supplier_id" not in item:
        item["supplier_id"] = "sup-general"
    return item

def update_ingredient(item_id, updates: dict) -> Optional[dict]:
    """Updates ingredient fields, allowing changing an ingredient's supplier."""
    global _mongo_db, _firestore_db, _in_memory_db
    item = get_ingredient(item_id)
    if not item:
        return None

    clean = dict(updates)
    sup = None
    if "supplier_id" in clean and clean["supplier_id"]:
        sup = get_supplier(clean["supplier_id"])
    elif "supplier" in clean and clean["supplier"]:
        sup = get_supplier(clean["supplier"])

    if sup:
        clean["supplier_id"] = sup["id"]
        clean["supplier"] = sup["name"]
        clean["lead_time_days"] = int(sup["lead_time_days"])

    iso_timestamp = datetime.utcnow().isoformat() + "Z"
    clean["updated_at"] = iso_timestamp
    s_id = str(item_id)

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            query = {"$or": [{"_id": s_id}, {"id": s_id}]}
            if s_id.isdigit():
                query["$or"].append({"id": int(s_id)})
            coll.update_one(query, {"$set": clean})
        except Exception as e:
            logger.error(f"MongoDB update_ingredient failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("pantry_ingredients").document(s_id).update(clean)
        except Exception as e:
            logger.error(f"Firestore update_ingredient failed: {e}")

    # 3. In-Memory
    target_key = None
    if item_id in _in_memory_db:
        target_key = item_id
    else:
        for k in _in_memory_db.keys():
            if str(k) == s_id:
                target_key = k
                break
    if target_key is not None:
        _in_memory_db[target_key].update(clean)

    return get_ingredient(item_id)

def seed_firestore_if_empty():
    """Seeds the core ingredients and core suppliers if empty."""
    global _mongo_db, _firestore_db, _in_memory_db, _in_memory_suppliers

    # MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            if coll.count_documents({}) == 0:
                for item in CORE_INGREDIENTS:
                    doc = dict(item, _id=str(item["id"]), daily_sales=dict(item["daily_sales"]))
                    coll.insert_one(doc)
                logger.info("MongoDB pantry_ingredients collection seeded with core ingredients.")

            s_coll = _mongo_db["suppliers"]
            if s_coll.count_documents({}) == 0:
                for s in CORE_SUPPLIERS:
                    s_coll.insert_one(dict(s, _id=s["id"]))
        except Exception as e:
            logger.error(f"Error seeding MongoDB: {e}")
        return

    # Firestore
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = list(coll_ref.limit(1).stream())
            if not docs:
                for item in CORE_INGREDIENTS:
                    doc_data = dict(item, daily_sales=dict(item["daily_sales"]))
                    coll_ref.document(str(item["id"])).set(doc_data)
                logger.info("Firestore pantry_ingredients collection seeded.")

            s_coll = _firestore_db.collection("suppliers")
            if not list(s_coll.limit(1).stream()):
                for s in CORE_SUPPLIERS:
                    s_coll.document(s["id"]).set(s)
        except Exception as e:
            logger.error(f"Error seeding Firestore: {e}")
    else:
        # In-Memory
        if not _in_memory_db:
            _in_memory_db = {item["id"]: dict(item, daily_sales=dict(item["daily_sales"])) for item in CORE_INGREDIENTS}
        if not _in_memory_suppliers:
            _in_memory_suppliers = {s["id"]: dict(s) for s in CORE_SUPPLIERS}

def get_all_ingredients():
    """Fetches all ingredients with backward-compatible 14-day sales list and derived supplier data."""
    global _mongo_db, _firestore_db, _in_memory_db
    results = []

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            for doc in coll.find({}):
                clean = _clean_mongo_doc(doc)
                ds = clean.get("daily_sales", {})
                clean["daily_sales"] = ds
                clean["sales"] = get_last_14_days_sales(ds)
                clean["is_cursed"] = is_ingredient_cursed(clean["id"]) or clean.get("is_cursed", False)
                results.append(clean)
            if results:
                for r in results:
                    _enrich_ingredient_with_supplier(r)
                results.sort(key=lambda x: str(x["id"]))
                return results
        except Exception as e:
            logger.error(f"Error fetching from MongoDB ({e}). Falling back to memory.")

    # 2. Firestore
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = coll_ref.stream()
            for doc in docs:
                data = doc.to_dict()
                if "id" not in data:
                    try:
                        data["id"] = int(doc.id)
                    except ValueError:
                        data["id"] = doc.id
                ds = data.get("daily_sales", {})
                data["daily_sales"] = ds
                data["sales"] = get_last_14_days_sales(ds)
                data["is_cursed"] = is_ingredient_cursed(data["id"]) or data.get("is_cursed", False)
                results.append(data)
            if results:
                for r in results:
                    _enrich_ingredient_with_supplier(r)
                results.sort(key=lambda x: str(x["id"]))
                return results
        except Exception as e:
            logger.error(f"Error fetching from Firestore ({e}). Using in-memory fallback.")

    # 3. In-Memory
    for item in _in_memory_db.values():
        item_copy = dict(item)
        ds = item_copy.get("daily_sales", {})
        item_copy["sales"] = get_last_14_days_sales(ds)
        item_copy["is_cursed"] = is_ingredient_cursed(item_copy["id"]) or item_copy.get("is_cursed", False)
        results.append(item_copy)

    for r in results:
        _enrich_ingredient_with_supplier(r)
    results.sort(key=lambda x: str(x["id"]))
    return results

def add_ingredient(payload: dict) -> dict:
    """
    Creates a new ingredient with initialized expected_stock = current_stock
    and default baseline daily_sales.
    Persists across MongoDB (if configured), Firestore (if configured), and in-memory store.
    """
    global _mongo_db, _firestore_db, _in_memory_db

    all_items = get_all_ingredients()
    existing_numeric_ids = [
        int(item["id"]) for item in all_items
        if str(item.get("id", "")).isdigit()
    ]
    new_id = (max(existing_numeric_ids) + 1) if existing_numeric_ids else (len(all_items) + 1)

    current_stock = int(payload.get("current_stock", 50))
    safety_stock = int(payload.get("safety_stock", 20))
    sup = None
    if payload.get("supplier_id"):
        sup = get_supplier(payload["supplier_id"])
    elif payload.get("supplier"):
        sup = get_supplier(payload["supplier"])

    if sup:
        supplier_id = sup["id"]
        supplier = sup["name"]
        lead_time_days = int(sup["lead_time_days"])
    else:
        supplier_id = str(payload.get("supplier_id") or "sup-general")
        supplier = str(payload.get("supplier") or "General Supplier").strip()
        lead_time_days = int(payload.get("lead_time_days", 3))

    name = str(payload.get("name", f"Ingredient {new_id}")).strip()
    category = str(payload.get("category") or "Raw Ingredients").strip()
    unit = str(payload.get("unit") or "units").strip()

    today = datetime.now().date()
    default_daily = payload.get("daily_sales")
    if not default_daily:
        default_daily = {
            (today - timedelta(days=13 - idx)).strftime("%Y-%m-%d"): 5
            for idx in range(14)
        }

    item_data = {
        "id": new_id,
        "name": name,
        "category": category,
        "unit": unit,
        "current_stock": current_stock,
        "expected_stock": current_stock,
        "safety_stock": safety_stock,
        "supplier_id": supplier_id,
        "supplier": supplier,
        "lead_time_days": lead_time_days,
        "is_cursed": bool(payload.get("is_cursed", False)),
        "daily_sales": default_daily,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            mongo_doc = dict(item_data, _id=str(new_id))
            coll.insert_one(mongo_doc)
            logger.info(f"Ingredient {new_id} added to MongoDB.")
        except Exception as e:
            logger.error(f"Error adding ingredient to MongoDB: {e}")

    # 2. Firestore
    if _firestore_db is not None:
        try:
            _firestore_db.collection("pantry_ingredients").document(str(new_id)).set(item_data)
            logger.info(f"Ingredient {new_id} added to Firestore.")
        except Exception as e:
            logger.error(f"Error adding ingredient to Firestore: {e}")

    # 3. In-Memory
    _in_memory_db[new_id] = dict(item_data)

    if current_stock > 0:
        record_movement(
            item_id=new_id,
            item_name=name,
            mov_type="initial",
            quantity_delta=current_stock,
            resulting_stock=current_stock,
            reason="Initial apothecary pantry ledger audit"
        )

    result = dict(item_data)
    result["sales"] = get_last_14_days_sales(result["daily_sales"])
    result["is_cursed"] = is_ingredient_cursed(new_id) or result.get("is_cursed", False)
    return result

def get_ingredient(item_id):
    global _mongo_db, _firestore_db, _in_memory_db
    s_id = str(item_id)

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            query = {"$or": [{"_id": s_id}, {"id": s_id}]}
            if s_id.isdigit():
                query["$or"].append({"id": int(s_id)})
            doc = coll.find_one(query)
            if doc:
                clean = _clean_mongo_doc(doc)
                ds = clean.get("daily_sales", {})
                clean["daily_sales"] = ds
                clean["sales"] = get_last_14_days_sales(ds)
                clean["is_cursed"] = is_ingredient_cursed(clean["id"]) or clean.get("is_cursed", False)
                return _enrich_ingredient_with_supplier(clean)
        except Exception as e:
            logger.error(f"Error getting ingredient from MongoDB: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            doc = _firestore_db.collection("pantry_ingredients").document(s_id).get()
            if doc.exists:
                data = doc.to_dict()
                if "id" not in data:
                    data["id"] = item_id
                ds = data.get("daily_sales", {})
                data["daily_sales"] = ds
                data["sales"] = get_last_14_days_sales(ds)
                data["is_cursed"] = is_ingredient_cursed(data["id"]) or data.get("is_cursed", False)
                return _enrich_ingredient_with_supplier(data)
        except Exception as e:
            logger.error(f"Error getting ingredient from Firestore: {e}")

    # 3. In-Memory
    item = _in_memory_db.get(item_id)
    if not item and isinstance(item_id, str) and item_id.isdigit():
        item = _in_memory_db.get(int(item_id))
    if not item:
        for k, v in _in_memory_db.items():
            if str(k) == s_id:
                item = v
                break
    if item:
        item_copy = dict(item)
        ds = item_copy.get("daily_sales", {})
        item_copy["sales"] = get_last_14_days_sales(ds)
        item_copy["is_cursed"] = is_ingredient_cursed(item_copy["id"]) or item_copy.get("is_cursed", False)
        return _enrich_ingredient_with_supplier(item_copy)
    return None

def create_movement_record(
    item_id: Union[int, str],
    item_name: str,
    mov_type: str,
    quantity_delta: int,
    resulting_stock: Optional[int] = None,
    reason: Optional[str] = None,
    timestamp: Optional[str] = None,
    movement_id: Optional[str] = None,
    supplier_id: Optional[str] = None
) -> dict:
    if not movement_id:
        movement_id = f"mov-{int(datetime.utcnow().timestamp() * 1000)}-{uuid.uuid4().hex[:6]}"
    if not timestamp:
        timestamp = datetime.utcnow().isoformat() + "Z"

    norm_id = int(item_id) if str(item_id).isdigit() else item_id

    record = {
        "id": str(movement_id),
        "item_id": norm_id,
        "itemId": norm_id,
        "item_name": str(item_name),
        "itemName": str(item_name),
        "type": str(mov_type),
        "quantity_delta": int(quantity_delta),
        "quantityDelta": int(quantity_delta),
        "resulting_stock": int(resulting_stock) if resulting_stock is not None else None,
        "quantityAfter": int(resulting_stock) if resulting_stock is not None else None,
        "reason": str(reason or ""),
        "notes": str(reason or ""),
        "timestamp": str(timestamp)
    }
    if supplier_id:
        record["supplierId"] = str(supplier_id)
        record["supplier_id"] = str(supplier_id)
    return record

def record_movement(
    item_id: Union[int, str],
    item_name: str,
    mov_type: str,
    quantity_delta: int,
    resulting_stock: Optional[int] = None,
    reason: Optional[str] = None,
    timestamp: Optional[str] = None,
    movement_id: Optional[str] = None,
    supplier_id: Optional[str] = None
) -> dict:
    """
    Creates and saves a movement record across MongoDB Atlas, Firestore, and in-memory store.
    Matches the schema expected by db-service.js and backend requirement 1 & 4.
    """
    global _mongo_db, _firestore_db, _in_memory_movements
    record = create_movement_record(
        item_id=item_id,
        item_name=item_name,
        mov_type=mov_type,
        quantity_delta=quantity_delta,
        resulting_stock=resulting_stock,
        reason=reason,
        timestamp=timestamp,
        movement_id=movement_id,
        supplier_id=supplier_id
    )

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["stock_movements"]
            doc = dict(record, _id=record["id"])
            coll.replace_one({"_id": record["id"]}, doc, upsert=True)
        except Exception as e:
            logger.error(f"MongoDB record_movement failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("stock_movements").document(record["id"]).set(record)
        except Exception as e:
            logger.error(f"Firestore record_movement failed ({e}).")

    # 3. In-Memory
    _in_memory_movements[record["id"]] = record
    return record

def get_movements(
    item_id: Optional[Union[str, int]] = None,
    movement_type: Optional[str] = None,
    limit: int = 100
) -> list[dict]:
    """
    Returns newest stock movements first, filterable by item_id and movement type.
    """
    global _mongo_db, _firestore_db, _in_memory_movements

    s_item_id = str(item_id).strip().lower() if item_id is not None and str(item_id).strip() != "" else None
    s_mov_type = str(movement_type).strip().lower() if movement_type is not None and str(movement_type).strip() != "" else None

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["stock_movements"]
            query = {}
            if s_item_id is not None:
                q_list = [{"item_id": s_item_id}, {"itemId": s_item_id}]
                if s_item_id.isdigit():
                    q_list.extend([{"item_id": int(s_item_id)}, {"itemId": int(s_item_id)}])
                query["$or"] = q_list
            if s_mov_type is not None:
                query["type"] = s_mov_type

            cursor = coll.find(query).sort("timestamp", -1).limit(limit)
            results = [_clean_mongo_doc(d) for d in cursor]
            if results:
                return results
        except Exception as e:
            logger.error(f"MongoDB get_movements failed ({e}). Falling back.")

    # 2. Firestore
    if _firestore_db:
        try:
            coll = _firestore_db.collection("stock_movements")
            docs = coll.stream()
            results = []
            for doc in docs:
                d = doc.to_dict()
                if "id" not in d:
                    d["id"] = doc.id
                if s_item_id is not None:
                    if str(d.get("item_id", "")).lower() != s_item_id and str(d.get("itemId", "")).lower() != s_item_id:
                        continue
                if s_mov_type is not None:
                    if str(d.get("type", "")).lower() != s_mov_type:
                        continue
                results.append(d)
            results.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
            return results[:limit]
        except Exception as e:
            logger.error(f"Firestore get_movements failed ({e}). Falling back.")

    # 3. In-Memory
    results = []
    for m in _in_memory_movements.values():
        if s_item_id is not None:
            if str(m.get("item_id", "")).lower() != s_item_id and str(m.get("itemId", "")).lower() != s_item_id:
                continue
        if s_mov_type is not None:
            if str(m.get("type", "")).lower() != s_mov_type:
                continue
        results.append(dict(m))

    results.sort(key=lambda x: str(x.get("timestamp", "")), reverse=True)
    return results[:limit]

def record_sale(item_id, quantity: int, reason: Optional[str] = None) -> Optional[dict]:
    return update_stock_and_sales(item_id, -abs(int(quantity)), reason=reason or "Customer Sale", mov_type="sale")

def record_delivery(item_id, quantity: int, supplier_id: Optional[str] = None, notes: Optional[str] = None) -> Optional[dict]:
    r = notes or (f"Delivery from {supplier_id}" if supplier_id else "Supplier Delivery Restock")
    return update_stock_and_sales(item_id, abs(int(quantity)), reason=r, mov_type="delivery", supplier_id=supplier_id)

def record_adjustment(item_id, quantity_delta: int, reason: Optional[str] = None) -> Optional[dict]:
    return update_stock_and_sales(item_id, int(quantity_delta), reason=reason or "Manual stock inventory count correction", mov_type="adjustment")

def update_stock_and_sales(item_id, change_amount: int, reason: Optional[str] = None, mov_type: Optional[str] = None, supplier_id: Optional[str] = None):
    """
    Atomically updates stock, records sale to TODAY's date key in daily_sales map,
    and creates a corresponding stock movement record.
    """
    global _mongo_db, _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
    today_str = now.strftime("%Y-%m-%d")
    s_id = str(item_id)

    # Determine movement type & reason if not provided
    if not mov_type:
        if change_amount < 0:
            mov_type = "sale"
        elif change_amount > 0:
            mov_type = "delivery"
        else:
            mov_type = "adjustment"

    if not reason:
        if mov_type == "sale":
            reason = "Customer Sale"
        elif mov_type == "delivery":
            reason = "Supplier Delivery Restock"
        else:
            reason = "Stock Adjustment"

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            query = {"$or": [{"_id": s_id}, {"id": s_id}]}
            if s_id.isdigit():
                query["$or"].append({"id": int(s_id)})
            doc = coll.find_one(query)
            if doc:
                new_stock = max(0, int(doc.get("current_stock", 0)) + change_amount)
                daily_sales = dict(doc.get("daily_sales", {}))
                if change_amount < 0:
                    units = abs(change_amount)
                    daily_sales[today_str] = int(daily_sales.get(today_str, 0)) + units

                coll.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {
                        "current_stock": new_stock,
                        "expected_stock": new_stock,
                        "daily_sales": daily_sales,
                        "updated_at": iso_timestamp
                    }}
                )
                _mongo_db["transactions"].insert_one({
                    "item_id": doc.get("id", s_id),
                    "change_amount": change_amount,
                    "timestamp": iso_timestamp,
                    "resulting_stock": new_stock,
                    "type": mov_type
                })

                record_movement(
                    item_id=doc.get("id", s_id),
                    item_name=doc.get("name", f"Item {s_id}"),
                    mov_type=mov_type,
                    quantity_delta=change_amount,
                    resulting_stock=new_stock,
                    reason=reason,
                    timestamp=iso_timestamp,
                    supplier_id=supplier_id
                )

                clean = _clean_mongo_doc(doc)
                clean["current_stock"] = new_stock
                clean["expected_stock"] = new_stock
                clean["daily_sales"] = daily_sales
                clean["sales"] = get_last_14_days_sales(daily_sales)
                clean["is_cursed"] = is_ingredient_cursed(clean["id"]) or clean.get("is_cursed", False)
                return clean
        except Exception as e:
            logger.error(f"MongoDB update failed ({e}). Falling back.")

    # 2. Firestore
    if _firestore_db:
        try:
            doc_ref = _firestore_db.collection("pantry_ingredients").document(s_id)
            snapshot = doc_ref.get()
            if not snapshot.exists:
                return None
            data = snapshot.to_dict()
            new_stock = max(0, int(data.get("current_stock", 0)) + change_amount)
            daily_sales = dict(data.get("daily_sales", {}))

            if change_amount < 0:
                units = abs(change_amount)
                daily_sales[today_str] = int(daily_sales.get(today_str, 0)) + units

            doc_ref.update({
                "current_stock": new_stock,
                "expected_stock": new_stock,
                "daily_sales": daily_sales,
                "updated_at": iso_timestamp
            })

            doc_ref.collection("transactions").add({
                "change_amount": change_amount,
                "timestamp": iso_timestamp,
                "resulting_stock": new_stock,
                "type": mov_type
            })

            record_movement(
                item_id=data.get("id", item_id),
                item_name=data.get("name", f"Item {s_id}"),
                mov_type=mov_type,
                quantity_delta=change_amount,
                resulting_stock=new_stock,
                reason=reason,
                timestamp=iso_timestamp,
                supplier_id=supplier_id
            )

            data["current_stock"] = new_stock
            data["expected_stock"] = new_stock
            data["daily_sales"] = daily_sales
            data["sales"] = get_last_14_days_sales(daily_sales)
            if "id" not in data:
                data["id"] = item_id
            data["is_cursed"] = is_ingredient_cursed(data["id"]) or data.get("is_cursed", False)
            return data
        except Exception as e:
            logger.error(f"Firestore update failed ({e}). Falling back to in-memory.")

    # 3. In-memory update
    target_key = None
    if item_id in _in_memory_db:
        target_key = item_id
    else:
        for k in _in_memory_db.keys():
            if str(k) == s_id:
                target_key = k
                break
    if target_key is None:
        return None

    item = _in_memory_db[target_key]
    item["current_stock"] = max(0, item["current_stock"] + change_amount)
    item["expected_stock"] = item["current_stock"]
    if "daily_sales" not in item:
        item["daily_sales"] = {}
    if change_amount < 0:
        units = abs(change_amount)
        item["daily_sales"][today_str] = int(item["daily_sales"].get(today_str, 0)) + units

    _in_memory_transactions.append({
        "item_id": target_key,
        "change_amount": change_amount,
        "timestamp": iso_timestamp,
        "resulting_stock": item["current_stock"],
        "type": mov_type
    })

    record_movement(
        item_id=target_key,
        item_name=item.get("name", f"Item {target_key}"),
        mov_type=mov_type,
        quantity_delta=change_amount,
        resulting_stock=item["current_stock"],
        reason=reason,
        timestamp=iso_timestamp,
        supplier_id=supplier_id
    )

    item_copy = dict(item)
    item_copy["sales"] = get_last_14_days_sales(item_copy["daily_sales"])
    item_copy["is_cursed"] = is_ingredient_cursed(item_copy["id"]) or item_copy.get("is_cursed", False)
    return item_copy

def audit_stock(item_id, missing_amount: int, reason: Optional[str] = None):
    """
    Reduces current_stock without reducing expected_stock to trigger anomaly,
    and logs an audit_missing stock movement.
    """
    global _mongo_db, _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
    s_id = str(item_id)
    audit_reason = reason or f"Shelf audit shrinkage: {missing_amount} units missing"

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            query = {"$or": [{"_id": s_id}, {"id": s_id}]}
            if s_id.isdigit():
                query["$or"].append({"id": int(s_id)})
            doc = coll.find_one(query)
            if doc:
                new_stock = max(0, int(doc.get("current_stock", 0)) - missing_amount)
                coll.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"current_stock": new_stock, "updated_at": iso_timestamp}}
                )
                _mongo_db["transactions"].insert_one({
                    "item_id": doc.get("id", s_id),
                    "change_amount": -missing_amount,
                    "timestamp": iso_timestamp,
                    "type": "audit_missing"
                })
                record_movement(
                    item_id=doc.get("id", s_id),
                    item_name=doc.get("name", f"Item {s_id}"),
                    mov_type="audit_missing",
                    quantity_delta=-abs(missing_amount),
                    resulting_stock=new_stock,
                    reason=audit_reason,
                    timestamp=iso_timestamp
                )
                clean = _clean_mongo_doc(doc)
                clean["current_stock"] = new_stock
                clean["sales"] = get_last_14_days_sales(clean.get("daily_sales", {}))
                clean["is_cursed"] = is_ingredient_cursed(clean["id"]) or clean.get("is_cursed", False)
                return clean
        except Exception as e:
            logger.error(f"MongoDB audit failed ({e}).")

    # 2. Firestore
    if _firestore_db:
        try:
            doc_ref = _firestore_db.collection("pantry_ingredients").document(s_id)
            snapshot = doc_ref.get()
            if not snapshot.exists:
                return None
            data = snapshot.to_dict()
            new_stock = max(0, int(data.get("current_stock", 0)) - missing_amount)
            doc_ref.update({
                "current_stock": new_stock,
                "updated_at": iso_timestamp
            })
            doc_ref.collection("transactions").add({
                "change_amount": -missing_amount,
                "timestamp": iso_timestamp,
                "type": "audit_missing"
            })
            record_movement(
                item_id=data.get("id", item_id),
                item_name=data.get("name", f"Item {s_id}"),
                mov_type="audit_missing",
                quantity_delta=-abs(missing_amount),
                resulting_stock=new_stock,
                reason=audit_reason,
                timestamp=iso_timestamp
            )
            data["current_stock"] = new_stock
            if "id" not in data:
                data["id"] = item_id
            data["sales"] = get_last_14_days_sales(data.get("daily_sales", {}))
            data["is_cursed"] = is_ingredient_cursed(data["id"]) or data.get("is_cursed", False)
            return data
        except Exception as e:
            logger.error(f"Firestore audit failed ({e}). Falling back to in-memory.")

    # 3. In-Memory
    target_key = None
    if item_id in _in_memory_db:
        target_key = item_id
    else:
        for k in _in_memory_db.keys():
            if str(k) == s_id:
                target_key = k
                break
    if target_key is None:
        return None

    item = _in_memory_db[target_key]
    item["current_stock"] = max(0, item["current_stock"] - missing_amount)
    record_movement(
        item_id=target_key,
        item_name=item.get("name", f"Item {target_key}"),
        mov_type="audit_missing",
        quantity_delta=-abs(missing_amount),
        resulting_stock=item["current_stock"],
        reason=audit_reason,
        timestamp=iso_timestamp
    )
    item_copy = dict(item)
    item_copy["sales"] = get_last_14_days_sales(item_copy.get("daily_sales", {}))
    item_copy["is_cursed"] = is_ingredient_cursed(item_copy["id"]) or item_copy.get("is_cursed", False)
    return item_copy

def set_cursed_ingredients(cursed_ids: list):
    """Updates legacy is_cursed for all ingredients."""
    global _mongo_db, _firestore_db, _in_memory_db
    c_set = {str(x) for x in cursed_ids}

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            for doc in coll.find({}):
                doc_id = str(doc.get("id", doc.get("_id")))
                is_cursed = (doc_id in c_set) or (str(doc.get("_id")) in c_set)
                coll.update_one({"_id": doc["_id"]}, {"$set": {"is_cursed": is_cursed}})
            return True
        except Exception as e:
            logger.error(f"MongoDB curse update failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = coll_ref.stream()
            for doc in docs:
                doc_id = str(doc.id)
                data = doc.to_dict()
                i_id = str(data.get("id", doc_id))
                is_cursed = (doc_id in c_set) or (i_id in c_set)
                doc.reference.update({"is_cursed": is_cursed})
            return True
        except Exception as e:
            logger.error(f"Firestore curse update failed ({e}). Falling back to in-memory.")

    # 3. In-Memory
    for k, item in _in_memory_db.items():
        item["is_cursed"] = (str(k) in c_set) or (str(item.get("id")) in c_set)
    return True

def get_ingredient_sales_history(item_id, days: int = 60) -> list[dict]:
    """Returns chronological [{date: YYYY-MM-DD, units_sold: int}] for the past N days."""
    item = get_ingredient(item_id)
    if not item:
        return []
    daily_sales = item.get("daily_sales", {})
    today = datetime.now().date()
    history = []
    for i in range(days - 1, -1, -1):
        d_str = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        history.append({
            "date": d_str,
            "units_sold": int(daily_sales.get(d_str, 0))
        })
    return history


# =====================================================================
# Events Management System (MongoDB 'events' + Firestore + In-Memory)
# =====================================================================

def add_event(event_data: dict) -> dict:
    """Creates a new surge event with name, ingredient_ids, start_date, end_date, and multiplier."""
    global _mongo_db, _firestore_db, _in_memory_events
    event_id = str(event_data.get("id") or f"event_{uuid.uuid4().hex[:8]}")
    
    raw_ids = event_data.get("ingredient_ids") or event_data.get("affected_ingredients") or []
    normalized_ids = []
    for x in raw_ids:
        try:
            normalized_ids.append(int(x))
        except (ValueError, TypeError):
            normalized_ids.append(str(x))

    new_event = {
        "id": event_id,
        "name": str(event_data.get("name") or "Festival"),
        "ingredient_ids": normalized_ids,
        "affected_ingredients": normalized_ids,
        "start_date": str(event_data.get("start_date")),
        "end_date": str(event_data.get("end_date")),
        "multiplier": float(event_data.get("multiplier", 3.0)),
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            doc = dict(new_event, _id=event_id)
            _mongo_db["events"].replace_one({"_id": event_id}, doc, upsert=True)
            logger.info(f"Event {event_id} added to MongoDB Atlas.")
            return new_event
        except Exception as e:
            logger.error(f"MongoDB add_event failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            _firestore_db.collection("events").document(event_id).set(new_event)
            logger.info(f"Event {event_id} added to Firestore.")
            return new_event
        except Exception as e:
            logger.error(f"Firestore add_event failed ({e}). Falling back to in-memory store.")

    # 3. In-Memory
    _in_memory_events[event_id] = new_event
    return new_event

def get_all_events() -> list[dict]:
    """Returns all scheduled events sorted by start date."""
    global _mongo_db, _firestore_db, _in_memory_events

    # 1. MongoDB
    if _mongo_db is not None:
        try:
            events = []
            for doc in _mongo_db["events"].find({}):
                clean = _clean_mongo_doc(doc)
                events.append(clean)
            events.sort(key=lambda x: str(x.get("start_date", "")))
            return events
        except Exception as e:
            logger.error(f"MongoDB get_all_events failed: {e}")

    # 2. Firestore
    if _firestore_db:
        try:
            docs = _firestore_db.collection("events").stream()
            events = []
            for doc in docs:
                d = doc.to_dict()
                if "id" not in d:
                    d["id"] = doc.id
                events.append(d)
            events.sort(key=lambda x: str(x.get("start_date", "")))
            return events
        except Exception as e:
            logger.error(f"Firestore get_all_events failed ({e}). Falling back to in-memory store.")

    # 3. In-Memory
    events = list(_in_memory_events.values())
    events.sort(key=lambda x: str(x.get("start_date", "")))
    return events

def get_event(event_id: str) -> Optional[dict]:
    """Fetches a single event by ID."""
    global _mongo_db, _firestore_db, _in_memory_events
    s_id = str(event_id)

    if _mongo_db is not None:
        try:
            doc = _mongo_db["events"].find_one({"$or": [{"_id": s_id}, {"id": s_id}]})
            if doc:
                return _clean_mongo_doc(doc)
        except Exception as e:
            logger.error(f"MongoDB get_event failed: {e}")

    if _firestore_db:
        try:
            doc = _firestore_db.collection("events").document(s_id).get()
            if doc.exists:
                d = doc.to_dict()
                d["id"] = s_id
                return d
        except Exception as e:
            logger.error(f"Firestore get_event failed ({e}). Falling back to in-memory store.")

    return _in_memory_events.get(s_id)

def delete_event(event_id: str) -> bool:
    """Deletes an event by ID."""
    global _mongo_db, _firestore_db, _in_memory_events
    s_id = str(event_id)
    deleted = False

    if _mongo_db is not None:
        try:
            res = _mongo_db["events"].delete_one({"$or": [{"_id": s_id}, {"id": s_id}]})
            if res.deleted_count > 0:
                deleted = True
        except Exception as e:
            logger.error(f"MongoDB delete_event failed: {e}")

    if _firestore_db:
        try:
            doc_ref = _firestore_db.collection("events").document(s_id)
            if doc_ref.get().exists:
                doc_ref.delete()
                deleted = True
        except Exception as e:
            logger.error(f"Firestore delete_event failed ({e}). Falling back to in-memory store.")

    if s_id in _in_memory_events:
        del _in_memory_events[s_id]
        deleted = True

    return deleted

def get_events_for_ingredient(ingredient_id) -> list[dict]:
    """Returns all events covering a specific ingredient ID."""
    all_events = get_all_events()
    str_id = str(ingredient_id).lower()
    matching = []
    for evt in all_events:
        raw_list = evt.get("ingredient_ids") or evt.get("affected_ingredients") or []
        c_set = {str(x).lower() for x in raw_list}
        if not c_set or str_id in c_set:
            matching.append(evt)
    return matching

def get_event_multiplier_for_date(ingredient_id, date_str: str) -> float:
    """Returns the surge multiplier applicable for an ingredient on a specific YYYY-MM-DD date."""
    events = get_events_for_ingredient(ingredient_id)
    multiplier = 1.0
    for evt in events:
        start = evt.get("start_date", "")
        end = evt.get("end_date", "")
        if start and end and start <= date_str <= end:
            multiplier = max(multiplier, float(evt.get("multiplier", 3.0)))
    return multiplier

def is_ingredient_cursed(ingredient_id) -> bool:
    """True if an active or upcoming event covers this ingredient (end_date >= today)."""
    today_str = datetime.now().date().strftime("%Y-%m-%d")
    for evt in get_events_for_ingredient(ingredient_id):
        if evt.get("end_date", "") >= today_str:
            return True
    return False
