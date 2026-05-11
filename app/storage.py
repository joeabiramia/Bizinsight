import json
import os
import time
from datetime import datetime
from typing import Dict, List, Optional

from pymongo import MongoClient
from pymongo.errors import PyMongoError, ServerSelectionTimeoutError

MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
MONGO_DB = os.getenv("MONGO_DB", "bizinsight")
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
METADATA_FILE = os.path.join(UPLOAD_FOLDER, "datasets.json")
USERS_FILE = os.path.join(UPLOAD_FOLDER, "users.json")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

_client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=1000)
_collection = _client[MONGO_DB]["files"]

_mongo_cache: Dict = {"available": None, "ts": 0.0}
_MONGO_CACHE_TTL = 30.0


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _load_local_records() -> List[Dict]:
    if not os.path.exists(METADATA_FILE):
        return []
    try:
        with open(METADATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_local_records(records: List[Dict]) -> None:
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, default=_json_default)


def _mongo_available() -> bool:
    now = time.monotonic()
    if _mongo_cache["available"] is not None and now - _mongo_cache["ts"] < _MONGO_CACHE_TTL:
        return _mongo_cache["available"]
    try:
        _client.admin.command("ping")
        result = True
    except (PyMongoError, ServerSelectionTimeoutError):
        result = False
    _mongo_cache["available"] = result
    _mongo_cache["ts"] = now
    return result


def insert_file_record(record: Dict) -> None:
    if _mongo_available():
        _collection.insert_one(record.copy())
        return

    records = _load_local_records()
    local_record = {k: _json_default(v) for k, v in record.items() if k != "_id"}
    records = [item for item in records if item.get("file_id") != local_record.get("file_id")]
    records.append(local_record)
    _save_local_records(records)


def get_file_record(file_id: str) -> Optional[Dict]:
    if _mongo_available():
        doc = _collection.find_one({"file_id": file_id}, {"_id": 0})
        return doc

    for item in _load_local_records():
        if item.get("file_id") == file_id:
            return item
    return None


def get_file_record_for_user(file_id: str, user_id: str) -> Optional[Dict]:
    """Return the file record only if it belongs to the given user."""
    if _mongo_available():
        doc = _collection.find_one({"file_id": file_id, "user_id": user_id}, {"_id": 0})
        return doc

    for item in _load_local_records():
        if item.get("file_id") == file_id and item.get("user_id") == user_id:
            return item
    return None


def list_file_records() -> List[Dict]:
    if _mongo_available():
        return list(
            _collection.find(
                {}, {"_id": 0, "file_id": 1, "filename": 1, "path": 1, "created_at": 1, "updated_at": 1}
            ).sort("created_at", -1)
        )

    records = _load_local_records()
    return sorted(records, key=lambda item: item.get("created_at") or "", reverse=True)


def list_file_records_for_user(user_id: str) -> List[Dict]:
    """Return only the file records owned by the given user."""
    if _mongo_available():
        return list(
            _collection.find(
                {"user_id": user_id},
                {"_id": 0, "file_id": 1, "filename": 1, "path": 1, "created_at": 1, "updated_at": 1},
            ).sort("created_at", -1)
        )

    records = _load_local_records()
    user_records = [r for r in records if r.get("user_id") == user_id]
    return sorted(user_records, key=lambda item: item.get("created_at") or "", reverse=True)


def storage_status() -> Dict[str, str]:
    if _mongo_available():
        return {"metadata_storage": "mongodb", "mongo": "connected"}
    return {"metadata_storage": "local_json", "mongo": "not connected - using local fallback"}


# ── User storage (always local JSON; MongoDB optional) ─────────────────────

_users_collection = _client[MONGO_DB]["users"] if True else None


def _load_users() -> List[Dict]:
    if not os.path.exists(USERS_FILE):
        return []
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_users(users: List[Dict]) -> None:
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2, default=_json_default)


def insert_user(user: Dict) -> None:
    if _mongo_available():
        try:
            _users_collection.insert_one(user.copy())
            return
        except Exception:
            pass
    users = _load_users()
    users = [u for u in users if u.get("user_id") != user.get("user_id")]
    clean = {k: _json_default(v) for k, v in user.items() if k != "_id"}
    users.append(clean)
    _save_users(users)


def get_user_by_email(email: str) -> Optional[Dict]:
    if _mongo_available():
        try:
            doc = _users_collection.find_one({"email": email}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass
    for u in _load_users():
        if u.get("email") == email:
            return u
    return None


def get_user_by_id(user_id: str) -> Optional[Dict]:
    if _mongo_available():
        try:
            doc = _users_collection.find_one({"user_id": user_id}, {"_id": 0})
            if doc:
                return doc
        except Exception:
            pass
    for u in _load_users():
        if u.get("user_id") == user_id:
            return u
    return None


def update_user_onboarding(user_id: str, onboarding_data: Dict) -> None:
    if _mongo_available():
        try:
            _users_collection.update_one(
                {"user_id": user_id},
                {"$set": {"onboarding_complete": True, "onboarding_data": onboarding_data}},
            )
            return
        except Exception:
            pass
    users = _load_users()
    for u in users:
        if u.get("user_id") == user_id:
            u["onboarding_complete"] = True
            u["onboarding_data"] = onboarding_data
            break
    _save_users(users)
