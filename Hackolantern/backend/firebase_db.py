import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("firebase_db")

CORE_INGREDIENTS = [
    {
        "id": 1,
        "name": "Bat Wings",
        "current_stock": 45,
        "expected_stock": 45,
        "safety_stock": 20,
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 2,
        "name": "Mandrake Root",
        "current_stock": 18,
        "expected_stock": 25,
        "safety_stock": 15,
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 3,
        "name": "Ghost Pepper",
        "current_stock": 60,
        "expected_stock": 60,
        "safety_stock": 25,
        "is_cursed": False,
        "daily_sales": {}
    },
    {
        "id": 4,
        "name": "Newt Eyes",
        "current_stock": 90,
        "expected_stock": 90,
        "safety_stock": 30,
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
_firestore_db = None

# Initialize Firebase
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
    logger.warning("No serviceAccountKey.json or FIREBASE_CREDENTIALS_PATH found. Running with in-memory DB fallback.")

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
    global _firestore_db, _in_memory_db
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
        if not _in_memory_db:
            _in_memory_db = {item["id"]: dict(item, daily_sales=dict(item["daily_sales"])) for item in CORE_INGREDIENTS}

def get_all_ingredients():
    """Fetches all ingredients with backward-compatible 14-day sales list."""
    global _firestore_db, _in_memory_db
    results = []
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
                results.append(data)
            if results:
                results.sort(key=lambda x: str(x["id"]))
                return results
        except Exception as e:
            logger.error(f"Error fetching from Firestore ({e}). Using in-memory fallback.")

    for item in _in_memory_db.values():
        item_copy = dict(item)
        ds = item_copy.get("daily_sales", {})
        item_copy["sales"] = get_last_14_days_sales(ds)
        results.append(item_copy)

    results.sort(key=lambda x: str(x["id"]))
    return results

def get_ingredient(item_id):
    global _firestore_db, _in_memory_db
    if _firestore_db:
        try:
            doc = _firestore_db.collection("pantry_ingredients").document(str(item_id)).get()
            if doc.exists:
                data = doc.to_dict()
                if "id" not in data:
                    data["id"] = item_id
                ds = data.get("daily_sales", {})
                data["daily_sales"] = ds
                data["sales"] = get_last_14_days_sales(ds)
                return data
        except Exception as e:
            logger.error(f"Error getting ingredient from Firestore: {e}")

    # check int or str id
    item = _in_memory_db.get(item_id)
    if not item and isinstance(item_id, str) and item_id.isdigit():
        item = _in_memory_db.get(int(item_id))
    if not item:
        for k, v in _in_memory_db.items():
            if str(k) == str(item_id):
                item = v
                break
    if item:
        item_copy = dict(item)
        ds = item_copy.get("daily_sales", {})
        item_copy["sales"] = get_last_14_days_sales(ds)
        return item_copy
    return None

def update_stock_and_sales(item_id, change_amount: int):
    """
    Atomically updates stock and records sale to TODAY's date key in daily_sales map.
    Every transaction log entry has an ISO timestamp.
    """
    global _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
    today_str = now.strftime("%Y-%m-%d")

    if _firestore_db:
        try:
            doc_ref = _firestore_db.collection("pantry_ingredients").document(str(item_id))
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
            return data
        except Exception as e:
            logger.error(f"Firestore update failed ({e}). Falling back to in-memory.")

    # In-memory update
    target_key = None
    if item_id in _in_memory_db:
        target_key = item_id
    else:
        for k in _in_memory_db.keys():
            if str(k) == str(item_id):
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
    return item_copy

def audit_stock(item_id, missing_amount: int):
    """Reduces current_stock without reducing expected_stock to trigger anomaly."""
    global _firestore_db, _in_memory_db
    now = datetime.utcnow()
    iso_timestamp = now.isoformat() + "Z"
    if _firestore_db:
        try:
            doc_ref = _firestore_db.collection("pantry_ingredients").document(str(item_id))
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
            return data
        except Exception as e:
            logger.error(f"Firestore audit failed ({e}). Falling back to in-memory.")

    target_key = None
    if item_id in _in_memory_db:
        target_key = item_id
    else:
        for k in _in_memory_db.keys():
            if str(k) == str(item_id):
                target_key = k
                break
    if target_key is None:
        return None

    item = _in_memory_db[target_key]
    item["current_stock"] = max(0, item["current_stock"] - missing_amount)
    item_copy = dict(item)
    item_copy["sales"] = get_last_14_days_sales(item_copy.get("daily_sales", {}))
    return item_copy

def set_cursed_ingredients(cursed_ids: list):
    """Updates is_cursed for all ingredients."""
    global _firestore_db, _in_memory_db
    c_set = {str(x) for x in cursed_ids}
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
