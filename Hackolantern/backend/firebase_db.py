import os
import logging
from datetime import datetime

logger = logging.getLogger("firebase_db")

CORE_INGREDIENTS = [
    {"id": 1, "name": "Bat Wings", "current_stock": 45, "expected_stock": 45, "safety_stock": 20, "is_cursed": False, "sales": [8, 9, 7, 10, 8, 9, 28]},
    {"id": 2, "name": "Mandrake Root", "current_stock": 18, "expected_stock": 25, "safety_stock": 15, "is_cursed": False, "sales": [4, 5, 4, 6, 5, 4, 5]},
    {"id": 3, "name": "Ghost Pepper", "current_stock": 60, "expected_stock": 60, "safety_stock": 25, "is_cursed": False, "sales": [10, 12, 11, 9, 10, 11, 10]},
    {"id": 4, "name": "Newt Eyes", "current_stock": 90, "expected_stock": 90, "safety_stock": 30, "is_cursed": False, "sales": [6, 5, 7, 6, 6, 5, 6]},
]

# In-memory fallback
_in_memory_db = {item["id"]: dict(item, sales=list(item["sales"])) for item in CORE_INGREDIENTS}
_in_memory_transactions = []
_firestore_db = None

# Initialize Firebase
creds_path = os.environ.get("FIREBASE_CREDENTIALS_PATH")
if not creds_path:
    # Check default locations
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

def seed_firestore_if_empty():
    """Seeds the 4 core ingredients if the collection or memory store is empty."""
    global _firestore_db, _in_memory_db
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = list(coll_ref.limit(1).stream())
            if not docs:
                for item in CORE_INGREDIENTS:
                    coll_ref.document(str(item["id"])).set(dict(item, sales=list(item["sales"])))
                logger.info("Firestore pantry_ingredients collection seeded.")
        except Exception as e:
            logger.error(f"Error seeding Firestore: {e}")
    else:
        if not _in_memory_db:
            _in_memory_db = {item["id"]: dict(item, sales=list(item["sales"])) for item in CORE_INGREDIENTS}

def get_all_ingredients():
    """Fetches all ingredients sorted by ID."""
    global _firestore_db, _in_memory_db
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = coll_ref.stream()
            results = []
            for doc in docs:
                data = doc.to_dict()
                if "id" not in data:
                    data["id"] = int(doc.id)
                results.append(data)
            if results:
                results.sort(key=lambda x: x["id"])
                return results
        except Exception as e:
            logger.error(f"Error fetching from Firestore ({e}). Using in-memory fallback.")

    return sorted(list(_in_memory_db.values()), key=lambda x: x["id"])

def get_ingredient(item_id: int):
    global _firestore_db, _in_memory_db
    if _firestore_db:
        try:
            doc = _firestore_db.collection("pantry_ingredients").document(str(item_id)).get()
            if doc.exists:
                data = doc.to_dict()
                if "id" not in data:
                    data["id"] = item_id
                return data
        except Exception as e:
            logger.error(f"Error getting ingredient from Firestore: {e}")

    return _in_memory_db.get(item_id)

def update_stock_and_sales(item_id: int, change_amount: int):
    """Atomically updates stock, expected stock, and sales in Firestore and logs transaction."""
    global _firestore_db, _in_memory_db
    timestamp = datetime.utcnow().isoformat()
    if _firestore_db:
        try:
            from google.cloud import firestore
            doc_ref = _firestore_db.collection("pantry_ingredients").document(str(item_id))
            snapshot = doc_ref.get()
            if not snapshot.exists:
                return None
            data = snapshot.to_dict()
            new_stock = max(0, int(data.get("current_stock", 0)) + change_amount)
            new_sales = list(data.get("sales", []))
            if change_amount < 0:
                new_sales.append(abs(change_amount))

            doc_ref.update({
                "current_stock": new_stock,
                "expected_stock": new_stock,
                "sales": new_sales,
                "updated_at": timestamp
            })

            doc_ref.collection("transactions").add({
                "change_amount": change_amount,
                "timestamp": timestamp,
                "resulting_stock": new_stock,
                "type": "sale" if change_amount < 0 else "restock"
            })

            data["current_stock"] = new_stock
            data["expected_stock"] = new_stock
            data["sales"] = new_sales
            if "id" not in data:
                data["id"] = item_id
            return data
        except Exception as e:
            logger.error(f"Firestore update failed ({e}). Falling back to in-memory.")

    if item_id not in _in_memory_db:
        return None
    item = _in_memory_db[item_id]
    item["current_stock"] = max(0, item["current_stock"] + change_amount)
    item["expected_stock"] = item["current_stock"]
    if change_amount < 0:
        item["sales"].append(abs(change_amount))
    _in_memory_transactions.append({
        "item_id": item_id,
        "change_amount": change_amount,
        "timestamp": timestamp
    })
    return item

def audit_stock(item_id: int, missing_amount: int):
    """Reduces current_stock without reducing expected_stock to trigger anomaly."""
    global _firestore_db, _in_memory_db
    timestamp = datetime.utcnow().isoformat()
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
                "updated_at": timestamp
            })
            doc_ref.collection("transactions").add({
                "change_amount": -missing_amount,
                "timestamp": timestamp,
                "type": "audit_discrepancy"
            })
            data["current_stock"] = new_stock
            if "id" not in data:
                data["id"] = item_id
            return data
        except Exception as e:
            logger.error(f"Firestore audit failed ({e}). Falling back to in-memory.")

    if item_id not in _in_memory_db:
        return None
    item = _in_memory_db[item_id]
    item["current_stock"] = max(0, item["current_stock"] - missing_amount)
    return item

def set_cursed_ingredients(cursed_ids: list[int]):
    """Updates is_cursed for all ingredients."""
    global _firestore_db, _in_memory_db
    if _firestore_db:
        try:
            coll_ref = _firestore_db.collection("pantry_ingredients")
            docs = coll_ref.stream()
            for doc in docs:
                i_id = int(doc.id) if doc.id.isdigit() else doc.to_dict().get("id")
                is_cursed = i_id in cursed_ids
                doc.reference.update({"is_cursed": is_cursed})
            return True
        except Exception as e:
            logger.error(f"Firestore curse update failed ({e}). Falling back to in-memory.")

    for item in _in_memory_db.values():
        item["is_cursed"] = item["id"] in cursed_ids
    return True
