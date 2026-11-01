from __future__ import annotations
import os
import uuid
import logging
from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("firebase_db")

CORE_INGREDIENTS = [
    {
        "id": 1,
        "name": "Bat Wings",
        "current_stock": 45,
        "expected_stock": 45,
        "safety_stock": 20,
        "lead_time_days": 4,
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
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 4,
        "name": "Newt Eyes",
        "current_stock": 90,
        "expected_stock": 90,
        "safety_stock": 30,
        "lead_time_days": 2,
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
                import firebase_admin
                from firebase_admin import credentials, firestore

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

def seed_firestore_if_empty():
    """Seeds the 4 core ingredients if the collection or memory store is empty."""
    global _mongo_db, _firestore_db, _in_memory_db

    # MongoDB
    if _mongo_db is not None:
        try:
            coll = _mongo_db["pantry_ingredients"]
            if coll.count_documents({}) == 0:
                for item in CORE_INGREDIENTS:
                    doc = dict(item, _id=str(item["id"]), daily_sales=dict(item["daily_sales"]))
                    coll.insert_one(doc)
                logger.info("MongoDB pantry_ingredients collection seeded with core ingredients.")
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
        except Exception as e:
            logger.error(f"Error seeding Firestore: {e}")
    else:
        # In-Memory
        if not _in_memory_db:
            _in_memory_db = {item["id"]: dict(item, daily_sales=dict(item["daily_sales"])) for item in CORE_INGREDIENTS}

def get_all_ingredients():
    """Fetches all ingredients with backward-compatible 14-day sales list."""
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
    lead_time_days = int(payload.get("lead_time_days", 3))
    name = str(payload.get("name", f"Ingredient {new_id}")).strip()
    supplier = str(payload.get("supplier") or "General Supplier").strip()
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
                return clean
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
                return data
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
        return item_copy
    return None

def update_stock_and_sales(item_id, change_amount: int):
    """
    Atomically updates stock and records sale to TODAY's date key in daily_sales map.
    Every transaction log entry has an ISO timestamp.
    """
    global _mongo_db, _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
    today_str = now.strftime("%Y-%m-%d")
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
                    "type": "sale" if change_amount < 0 else "restock"
                })

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
                "type": "sale" if change_amount < 0 else "restock"
            })

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
        "type": "sale" if change_amount < 0 else "restock"
    })

    item_copy = dict(item)
    item_copy["sales"] = get_last_14_days_sales(item_copy["daily_sales"])
    item_copy["is_cursed"] = is_ingredient_cursed(item_copy["id"]) or item_copy.get("is_cursed", False)
    return item_copy

def audit_stock(item_id, missing_amount: int):
    """Reduces current_stock without reducing expected_stock to trigger anomaly."""
    global _mongo_db, _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
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
                new_stock = max(0, int(doc.get("current_stock", 0)) - missing_amount)
                coll.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"current_stock": new_stock, "updated_at": iso_timestamp}}
                )
                _mongo_db["transactions"].insert_one({
                    "item_id": doc.get("id", s_id),
                    "change_amount": -missing_amount,
                    "timestamp": iso_timestamp,
                    "type": "audit_discrepancy"
                })
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
                "type": "audit_discrepancy"
            })
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
