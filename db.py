"""SQLite 저장소. 가게(방문자) 하나를 JSON 문서 하나로 저장한다."""
import json
import os
import sqlite3
import threading
import time

BASE = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE, "data", "gachi.db")
_lock = threading.Lock()


def _conn():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.execute("CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, updated REAL, data TEXT)")
    return c


def get(sid):
    if not sid:
        return None
    with _lock, _conn() as c:
        r = c.execute("SELECT data FROM stores WHERE id=?", (sid,)).fetchone()
    return json.loads(r[0]) if r else None


def save(sid, data):
    with _lock, _conn() as c:
        c.execute("INSERT OR REPLACE INTO stores VALUES (?,?,?)", (sid, time.time(), json.dumps(data, ensure_ascii=False)))
    return data


def delete(sid):
    with _lock, _conn() as c:
        c.execute("DELETE FROM stores WHERE id=?", (sid,))
