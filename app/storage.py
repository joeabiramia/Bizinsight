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
NOTIFICATIONS_FILE = os.path.join(UPLOAD_FOLDER, "notifications.json")

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


def delete_file_record(file_id: str, user_id: str) -> bool:
    """Delete a file record for the given user. Returns True if deleted."""
    if _mongo_available():
        result = _collection.delete_one({"file_id": file_id, "user_id": user_id})
        return result.deleted_count > 0

    records = _load_local_records()
    original_len = len(records)
    records = [r for r in records if not (r.get("file_id") == file_id and r.get("user_id") == user_id)]
    if len(records) < original_len:
        _save_local_records(records)
        return True
    return False


def storage_status() -> Dict[str, str]:
    if _mongo_available():
        return {"metadata_storage": "mongodb", "mongo": "connected"}
    return {"metadata_storage": "local_json", "mongo": "not connected - using local fallback"}


# ── Generic key-value store (local JSON, used by workspace/digest/etc.) ────────

_KV_FILE = os.path.join(UPLOAD_FOLDER, "kv_store.json")
_kv_collection = _client[MONGO_DB]["kv_store"]


def _load_kv() -> Dict:
    if not os.path.exists(_KV_FILE):
        return {}
    try:
        with open(_KV_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save_kv(data: Dict) -> None:
    with open(_KV_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=_json_default)


def kv_get(key: str):
    if _mongo_available():
        try:
            doc = _kv_collection.find_one({"key": key}, {"_id": 0})
            return doc.get("value") if doc else None
        except Exception:
            pass
    return _load_kv().get(key)


def kv_set(key: str, value) -> None:
    if _mongo_available():
        try:
            _kv_collection.update_one(
                {"key": key},
                {"$set": {"key": key, "value": value}},
                upsert=True,
            )
            return
        except Exception:
            pass
    data = _load_kv()
    data[key] = value
    _save_kv(data)


def kv_delete(key: str) -> None:
    if _mongo_available():
        try:
            _kv_collection.delete_one({"key": key})
            return
        except Exception:
            pass
    data = _load_kv()
    data.pop(key, None)
    _save_kv(data)


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


def update_user(user_id: str, updates: Dict) -> bool:
    """Apply arbitrary field updates to a user document (MongoDB + JSON fallback)."""
    clean = {k: _json_default(v) for k, v in updates.items() if k != "_id"}
    if _mongo_available():
        try:
            result = _users_collection.update_one(
                {"user_id": user_id}, {"$set": clean}
            )
            return result.matched_count > 0
        except Exception:
            pass
    users = _load_users()
    found = False
    for u in users:
        if u.get("user_id") == user_id:
            u.update(clean)
            found = True
            break
    if found:
        _save_users(users)
    return found


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


# ── Notification storage ────────────────────────────────────────────────────

_notifications_collection = _client[MONGO_DB]["notifications"]


def _load_notifications() -> List[Dict]:
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    try:
        with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_notifications(records: List[Dict]) -> None:
    with open(NOTIFICATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2, default=_json_default)


def insert_notifications(notification: Dict) -> None:
    if _mongo_available():
        try:
            _notifications_collection.insert_one(notification.copy())
            return
        except Exception:
            pass
    records = _load_notifications()
    clean = {k: _json_default(v) for k, v in notification.items() if k != "_id"}
    records = [r for r in records if r.get("notification_id") != clean.get("notification_id")]
    records.append(clean)
    _save_notifications(records)


def list_notifications_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _notifications_collection.find(
                    {"user_id": user_id}, {"_id": 0}
                ).sort("created_at", -1).limit(100)
            )
        except Exception:
            pass
    records = _load_notifications()
    user_records = [r for r in records if r.get("user_id") == user_id]
    return sorted(user_records, key=lambda r: r.get("created_at", ""), reverse=True)[:100]


def mark_notification_read(notification_id: str, user_id: str) -> bool:
    if _mongo_available():
        try:
            result = _notifications_collection.update_one(
                {"notification_id": notification_id, "user_id": user_id},
                {"$set": {"read": True}},
            )
            return result.matched_count > 0
        except Exception:
            pass
    records = _load_notifications()
    found = False
    for r in records:
        if r.get("notification_id") == notification_id and r.get("user_id") == user_id:
            r["read"] = True
            found = True
            break
    if found:
        _save_notifications(records)
    return found


def mark_all_notifications_read(user_id: str) -> int:
    if _mongo_available():
        try:
            result = _notifications_collection.update_many(
                {"user_id": user_id, "read": False},
                {"$set": {"read": True}},
            )
            return result.modified_count
        except Exception:
            pass
    records = _load_notifications()
    count = 0
    for r in records:
        if r.get("user_id") == user_id and not r.get("read", False):
            r["read"] = True
            count += 1
    if count:
        _save_notifications(records)
    return count


def delete_notification(notification_id: str, user_id: str) -> bool:
    if _mongo_available():
        try:
            result = _notifications_collection.delete_one(
                {"notification_id": notification_id, "user_id": user_id}
            )
            return result.deleted_count > 0
        except Exception:
            pass
    records = _load_notifications()
    new_records = [r for r in records if not (r.get("notification_id") == notification_id and r.get("user_id") == user_id)]
    deleted = len(records) != len(new_records)
    if deleted:
        _save_notifications(new_records)
    return deleted


# ── Generic JSON helpers ─────────────────────────────────────────────────────

def _load_json(path: str) -> List[Dict]:
    if not os.path.exists(path):
        return []
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


def _save_json(path: str, data: List[Dict]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=_json_default)


# ── Goals storage ─────────────────────────────────────────────────────────────

_goals_collection = _client[MONGO_DB]["goals"]
_GOALS_FILE = os.path.join(UPLOAD_FOLDER, "goals.json")


def insert_goal(goal: Dict) -> None:
    if _mongo_available():
        try:
            _goals_collection.insert_one(goal.copy())
            return
        except Exception:
            pass
    goals = _load_json(_GOALS_FILE)
    clean = {k: _json_default(v) for k, v in goal.items() if k != "_id"}
    goals = [g for g in goals if g.get("goal_id") != clean.get("goal_id")]
    goals.append(clean)
    _save_json(_GOALS_FILE, goals)


def get_goals_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _goals_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
            )
        except Exception:
            pass
    return [g for g in _load_json(_GOALS_FILE) if g.get("user_id") == user_id]


def update_goal(goal_id: str, user_id: str, data: Dict) -> bool:
    if _mongo_available():
        try:
            result = _goals_collection.update_one(
                {"goal_id": goal_id, "user_id": user_id}, {"$set": data}
            )
            return result.matched_count > 0
        except Exception:
            pass
    goals = _load_json(_GOALS_FILE)
    found = False
    for g in goals:
        if g.get("goal_id") == goal_id and g.get("user_id") == user_id:
            g.update({k: _json_default(v) for k, v in data.items()})
            found = True
            break
    if found:
        _save_json(_GOALS_FILE, goals)
    return found


def delete_goal(goal_id: str, user_id: str) -> bool:
    if _mongo_available():
        try:
            result = _goals_collection.delete_one({"goal_id": goal_id, "user_id": user_id})
            return result.deleted_count > 0
        except Exception:
            pass
    goals = _load_json(_GOALS_FILE)
    new_goals = [g for g in goals if not (g.get("goal_id") == goal_id and g.get("user_id") == user_id)]
    deleted = len(goals) != len(new_goals)
    if deleted:
        _save_json(_GOALS_FILE, new_goals)
    return deleted


# ── Automation rules storage ──────────────────────────────────────────────────

_automation_rules_collection = _client[MONGO_DB]["automation_rules"]
_automation_history_collection = _client[MONGO_DB]["automation_history"]
_AUTOMATION_RULES_FILE = os.path.join(UPLOAD_FOLDER, "automation_rules.json")
_AUTOMATION_HISTORY_FILE = os.path.join(UPLOAD_FOLDER, "automation_history.json")


def insert_automation_rule(rule: Dict) -> None:
    if _mongo_available():
        try:
            _automation_rules_collection.insert_one(rule.copy())
            return
        except Exception:
            pass
    rules = _load_json(_AUTOMATION_RULES_FILE)
    clean = {k: _json_default(v) for k, v in rule.items() if k != "_id"}
    rules = [r for r in rules if r.get("rule_id") != clean.get("rule_id")]
    rules.append(clean)
    _save_json(_AUTOMATION_RULES_FILE, rules)


def get_automation_rules_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _automation_rules_collection.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1)
            )
        except Exception:
            pass
    rules = _load_json(_AUTOMATION_RULES_FILE)
    return [r for r in rules if r.get("user_id") == user_id]


def get_automation_rule(rule_id: str, user_id: str) -> Optional[Dict]:
    if _mongo_available():
        try:
            doc = _automation_rules_collection.find_one(
                {"rule_id": rule_id, "user_id": user_id}, {"_id": 0}
            )
            if doc:
                return doc
        except Exception:
            pass
    for r in _load_json(_AUTOMATION_RULES_FILE):
        if r.get("rule_id") == rule_id and r.get("user_id") == user_id:
            return r
    return None


def update_automation_rule(rule_id: str, user_id: str, data: Dict) -> bool:
    if _mongo_available():
        try:
            result = _automation_rules_collection.update_one(
                {"rule_id": rule_id, "user_id": user_id}, {"$set": data}
            )
            return result.matched_count > 0
        except Exception:
            pass
    rules = _load_json(_AUTOMATION_RULES_FILE)
    found = False
    for r in rules:
        if r.get("rule_id") == rule_id and r.get("user_id") == user_id:
            r.update({k: _json_default(v) for k, v in data.items()})
            found = True
            break
    if found:
        _save_json(_AUTOMATION_RULES_FILE, rules)
    return found


def delete_automation_rule(rule_id: str, user_id: str) -> bool:
    if _mongo_available():
        try:
            result = _automation_rules_collection.delete_one({"rule_id": rule_id, "user_id": user_id})
            return result.deleted_count > 0
        except Exception:
            pass
    rules = _load_json(_AUTOMATION_RULES_FILE)
    new_rules = [r for r in rules if not (r.get("rule_id") == rule_id and r.get("user_id") == user_id)]
    deleted = len(rules) != len(new_rules)
    if deleted:
        _save_json(_AUTOMATION_RULES_FILE, new_rules)
    return deleted


def insert_automation_history(entry: Dict) -> None:
    if _mongo_available():
        try:
            _automation_history_collection.insert_one(entry.copy())
            return
        except Exception:
            pass
    history = _load_json(_AUTOMATION_HISTORY_FILE)
    clean = {k: _json_default(v) for k, v in entry.items() if k != "_id"}
    history.append(clean)
    _save_json(_AUTOMATION_HISTORY_FILE, history[-500:])


def get_automation_history_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _automation_history_collection.find({"user_id": user_id}, {"_id": 0})
                .sort("triggered_at", -1).limit(100)
            )
        except Exception:
            pass
    history = _load_json(_AUTOMATION_HISTORY_FILE)
    user_history = [h for h in history if h.get("user_id") == user_id]
    return sorted(user_history, key=lambda h: h.get("triggered_at", ""), reverse=True)[:100]


# ── Audit logs storage ────────────────────────────────────────────────────────

_audit_collection = _client[MONGO_DB]["audit_logs"]
_AUDIT_FILE = os.path.join(UPLOAD_FOLDER, "audit_logs.json")


def insert_audit_log(entry: Dict) -> None:
    if _mongo_available():
        try:
            _audit_collection.insert_one(entry.copy())
            return
        except Exception:
            pass
    logs = _load_json(_AUDIT_FILE)
    clean = {k: _json_default(v) for k, v in entry.items() if k != "_id"}
    logs.append(clean)
    _save_json(_AUDIT_FILE, logs[-1000:])


def get_audit_logs_for_user(user_id: str, limit: int = 100) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _audit_collection.find({"user_id": user_id}, {"_id": 0})
                .sort("created_at", -1).limit(limit)
            )
        except Exception:
            pass
    logs = _load_json(_AUDIT_FILE)
    user_logs = [l for l in logs if l.get("user_id") == user_id]
    return sorted(user_logs, key=lambda l: l.get("created_at", ""), reverse=True)[:limit]


# ── Data Sources storage (Google Sheets / Live Connectors) ───────────────────

_data_sources_collection = _client[MONGO_DB]["data_sources"]
_DATA_SOURCES_FILE = os.path.join(UPLOAD_FOLDER, "data_sources.json")


def insert_data_source(source: Dict) -> None:
    if _mongo_available():
        try:
            _data_sources_collection.insert_one(source.copy())
            return
        except Exception:
            pass
    sources = _load_json(_DATA_SOURCES_FILE)
    clean = {k: _json_default(v) for k, v in source.items() if k != "_id"}
    sources = [s for s in sources if s.get("source_id") != clean.get("source_id")]
    sources.append(clean)
    _save_json(_DATA_SOURCES_FILE, sources)


def get_data_source(source_id: str, user_id: str) -> Optional[Dict]:
    if _mongo_available():
        try:
            doc = _data_sources_collection.find_one(
                {"source_id": source_id, "user_id": user_id}, {"_id": 0}
            )
            if doc:
                return doc
        except Exception:
            pass
    for s in _load_json(_DATA_SOURCES_FILE):
        if s.get("source_id") == source_id and s.get("user_id") == user_id:
            return s
    return None


def list_data_sources_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _data_sources_collection.find({"user_id": user_id}, {"_id": 0})
                .sort("created_at", -1)
            )
        except Exception:
            pass
    sources = _load_json(_DATA_SOURCES_FILE)
    return sorted(
        [s for s in sources if s.get("user_id") == user_id],
        key=lambda s: s.get("created_at", ""),
        reverse=True,
    )


def update_data_source(source_id: str, user_id: str, data: Dict) -> bool:
    if _mongo_available():
        try:
            result = _data_sources_collection.update_one(
                {"source_id": source_id, "user_id": user_id}, {"$set": data}
            )
            return result.matched_count > 0
        except Exception:
            pass
    sources = _load_json(_DATA_SOURCES_FILE)
    found = False
    for s in sources:
        if s.get("source_id") == source_id and s.get("user_id") == user_id:
            s.update({k: _json_default(v) for k, v in data.items()})
            found = True
            break
    if found:
        _save_json(_DATA_SOURCES_FILE, sources)
    return found


# ── Real-time data storage ────────────────────────────────────────────────────

_realtime_collection = _client[MONGO_DB]["realtime_data"]
_REALTIME_FILE = os.path.join(UPLOAD_FOLDER, "realtime_data.json")


def insert_realtime_point(point: Dict) -> None:
    if _mongo_available():
        try:
            _realtime_collection.insert_one(point.copy())
            return
        except Exception:
            pass
    data = _load_json(_REALTIME_FILE)
    clean = {k: _json_default(v) for k, v in point.items() if k != "_id"}
    data.append(clean)
    _save_json(_REALTIME_FILE, data[-10000:])


def get_realtime_data(user_id: str, file_id: str, limit: int = 100) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _realtime_collection.find({"user_id": user_id, "file_id": file_id}, {"_id": 0})
                .sort("timestamp", -1).limit(limit)
            )
        except Exception:
            pass
    data = _load_json(_REALTIME_FILE)
    filtered = [d for d in data if d.get("user_id") == user_id and d.get("file_id") == file_id]
    return sorted(filtered, key=lambda d: d.get("timestamp", ""), reverse=True)[:limit]


# ── Share tokens ──────────────────────────────────────────────────────────────

_share_col = _client[MONGO_DB]["share_tokens"]
_SHARE_FILE = os.path.join(UPLOAD_FOLDER, "share_tokens.json")


def insert_share_token(r: Dict) -> None:
    if _mongo_available():
        try:
            _share_col.insert_one(r.copy()); return
        except Exception:
            pass
    items = _load_json(_SHARE_FILE)
    clean = {k: _json_default(v) for k, v in r.items() if k != "_id"}
    items = [i for i in items if i.get("token") != clean.get("token")]
    items.append(clean); _save_json(_SHARE_FILE, items)


def get_share_token(token: str) -> Optional[Dict]:
    if _mongo_available():
        try:
            doc = _share_col.find_one({"token": token}, {"_id": 0})
            if doc: return doc
        except Exception:
            pass
    for i in _load_json(_SHARE_FILE):
        if i.get("token") == token:
            return i
    return None


def list_share_tokens_for_user(user_id: str) -> List[Dict]:
    if _mongo_available():
        try:
            return list(_share_col.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1))
        except Exception:
            pass
    return [i for i in _load_json(_SHARE_FILE) if i.get("user_id") == user_id]


def delete_share_token(token: str, user_id: str) -> bool:
    if _mongo_available():
        try:
            r = _share_col.delete_one({"token": token, "user_id": user_id})
            return r.deleted_count > 0
        except Exception:
            pass
    items = _load_json(_SHARE_FILE)
    new = [i for i in items if not (i.get("token") == token and i.get("user_id") == user_id)]
    deleted = len(items) != len(new)
    if deleted: _save_json(_SHARE_FILE, new)
    return deleted


def increment_share_views(token: str) -> None:
    if _mongo_available():
        try:
            _share_col.update_one({"token": token}, {"$inc": {"views": 1}}); return
        except Exception:
            pass
    items = _load_json(_SHARE_FILE)
    for i in items:
        if i.get("token") == token:
            i["views"] = i.get("views", 0) + 1; break
    _save_json(_SHARE_FILE, items)


# ── Chat history ──────────────────────────────────────────────────────────────

_chat_col = _client[MONGO_DB]["chat_history"]
_CHAT_FILE = os.path.join(UPLOAD_FOLDER, "chat_history.json")


def insert_chat_message(msg: Dict) -> None:
    if _mongo_available():
        try:
            _chat_col.insert_one(msg.copy()); return
        except Exception:
            pass
    items = _load_json(_CHAT_FILE)
    clean = {k: _json_default(v) for k, v in msg.items() if k != "_id"}
    items.append(clean)
    _save_json(_CHAT_FILE, items[-5000:])


def list_chat_history(user_id: str, file_id: str, limit: int = 50) -> List[Dict]:
    if _mongo_available():
        try:
            return list(
                _chat_col.find({"user_id": user_id, "file_id": file_id}, {"_id": 0})
                .sort("timestamp", 1).limit(limit)
            )
        except Exception:
            pass
    items = _load_json(_CHAT_FILE)
    filtered = [i for i in items if i.get("user_id") == user_id and i.get("file_id") == file_id]
    return sorted(filtered, key=lambda x: x.get("timestamp", ""))[-limit:]


def clear_chat_history(user_id: str, file_id: str) -> None:
    if _mongo_available():
        try:
            _chat_col.delete_many({"user_id": user_id, "file_id": file_id}); return
        except Exception:
            pass
    items = _load_json(_CHAT_FILE)
    new = [i for i in items if not (i.get("user_id") == user_id and i.get("file_id") == file_id)]
    _save_json(_CHAT_FILE, new)


