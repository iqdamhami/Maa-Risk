"""
ماء ريسك — Backend API
مصادقة bcrypt + JWT، صلاحيات Admin/User، SQLite (متوافق مفهومياً مع schema PostgreSQL)
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, Field, field_validator

# ---------- Config ----------
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("MAARISK_DB", "/tmp/maarisk.db"))
SECRET_KEY = os.environ.get("MAARISK_SECRET") or "dev-only-change-me-maarisk-v20-stable"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8
# عند أول تشغيل يُنشأ المدير بكلمة عشوائية تُطبع مرة واحدة
ADMIN_EMAIL = "admin@maarisk.org"
ADMIN_INITIAL_PASSWORD = "Admin@123"

app = FastAPI(title="Mā’ Risk API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- DB ----------
def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """إنشاء الجداول وبذر المدير بكلمة ابتدائية ثابتة مرة واحدة فقط."""
    conn = get_conn()
    cur = conn.cursor()
    cur.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            active INTEGER NOT NULL DEFAULT 1,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            token_version INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            action TEXT NOT NULL,
            details TEXT,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            label TEXT,
            source TEXT,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_analyses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            title TEXT,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS central_data (
            key TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_by TEXT,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.commit()
    cur.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,))
    if not cur.fetchone():
        now = datetime.now(timezone.utc).isoformat()
        admin_id = "u_admin_default"
        cur.execute(
            """INSERT INTO users
               (id, email, password_hash, full_name, role, active, must_change_password, token_version, created_at, updated_at)
               VALUES (?, ?, ?, ?, 'admin', 1, 1, 0, ?, ?)""",
            (admin_id, ADMIN_EMAIL, hash_password(ADMIN_INITIAL_PASSWORD), "Admin", now, now),
        )
        conn.commit()
        audit(conn, admin_id, "bootstrap_admin", {
            "note": "admin created with fixed initial password; must_change_password=1"
        })
        # لا تُعاد كلمة المرور النصية ولا تُطبع في الطرفية
    conn.close()
    return None


def audit(conn: sqlite3.Connection, user_id: Optional[str], action: str, details: Any = None) -> None:
    conn.execute(
        "INSERT INTO audit_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)",
        (user_id, action, json.dumps(details or {}, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
    )
    conn.commit()


def hash_password(password: str) -> str:
    # bcrypt + UTF-8 (عربي/رموز)؛ قصّ آمن عند 72 بايت حسب حد bcrypt
    raw = password.encode("utf-8")
    if len(raw) > 72:
        raw = raw[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=12)).decode("ascii")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        raw = plain.encode("utf-8")
        if len(raw) > 72:
            raw = raw[:72]
        return bcrypt.checkpw(raw, hashed.encode("ascii"))
    except Exception:
        return False


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=120)

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("بريد غير صالح")
        return v


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def email_ok(cls, v: str) -> str:
        return v.strip().lower()


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False
    user: dict


# ---------- Auth helpers ----------
def create_token(user: sqlite3.Row) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user["role"],
        "tv": user["token_version"],
        "exp": exp,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_user_by_email(conn: sqlite3.Connection, email: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM users WHERE email = ?", (email.lower().strip(),)).fetchone()


def get_user_by_id(conn: sqlite3.Connection, user_id: str) -> Optional[sqlite3.Row]:
    return conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()


def current_user(authorization: Optional[str] = Header(None)) -> sqlite3.Row:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="يلزم تسجيل الدخول")
    token = authorization.split(" ", 1)[1].strip()
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="جلسة غير صالحة")
    conn = get_conn()
    user = get_user_by_id(conn, data.get("sub", ""))
    if not user or not user["active"]:
        conn.close()
        raise HTTPException(status_code=401, detail="حساب غير نشط أو غير موجود")
    if int(data.get("tv", -1)) != int(user["token_version"]):
        conn.close()
        raise HTTPException(status_code=401, detail="انتهت الجلسة بعد تغيير كلمة المرور — سجّل الدخول مجدداً")
    conn.close()
    return user


def require_admin(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="صلاحية المدير مطلوبة")
    if user["must_change_password"]:
        raise HTTPException(
            status_code=403,
            detail="يجب تغيير كلمة المرور قبل الوصول إلى وظائف الإدارة",
        )
    return user


def user_public(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "active": bool(row["active"]),
        "must_change_password": bool(row["must_change_password"]),
    }


# ---------- Routes: Auth ----------
@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok", "db": str(DB_PATH)}


@app.post("/auth/register", response_model=TokenOut)
def register(body: RegisterIn):
    if body.email.lower() == ADMIN_EMAIL:
        raise HTTPException(400, "هذا البريد محجوز")
    conn = get_conn()
    if get_user_by_email(conn, body.email):
        conn.close()
        raise HTTPException(409, "البريد مسجّل مسبقاً")
    now = datetime.now(timezone.utc).isoformat()
    uid = "u_" + secrets.token_hex(8)
    conn.execute(
        """INSERT INTO users (id, email, password_hash, full_name, role, active, must_change_password, token_version, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'user', 1, 0, 0, ?, ?)""",
        (uid, body.email.lower(), hash_password(body.password), body.full_name.strip(), now, now),
    )
    audit(conn, uid, "register", {"email": body.email.lower()})
    user = get_user_by_id(conn, uid)
    token = create_token(user)
    conn.close()
    return TokenOut(access_token=token, must_change_password=False, user=user_public(user))


@app.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn):
    conn = get_conn()
    user = get_user_by_email(conn, body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        audit(conn, user["id"] if user else None, "login_failed", {"email": body.email.lower()})
        conn.close()
        raise HTTPException(401, "البريد أو كلمة المرور غير صحيحة")
    if not user["active"]:
        conn.close()
        raise HTTPException(403, "تم إلغاء اشتراك هذا الحساب")
    audit(conn, user["id"], "login_ok", {})
    token = create_token(user)
    pub = user_public(user)
    conn.close()
    return TokenOut(
        access_token=token,
        must_change_password=bool(user["must_change_password"]),
        user=pub,
    )


@app.post("/auth/change-password")
def change_password(body: ChangePasswordIn, user: sqlite3.Row = Depends(current_user)):
    if body.new_password != body.confirm_password:
        raise HTTPException(400, "كلمتا المرور غير متطابقتين")
    if body.new_password == body.current_password:
        raise HTTPException(400, "كلمة المرور الجديدة يجب أن تختلف عن الحالية")
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(400, "كلمة المرور الحالية غير صحيحة")
    conn = get_conn()
    now = datetime.now(timezone.utc).isoformat()
    # زيادة token_version تُبطل كل الجلسات السابقة
    conn.execute(
        """UPDATE users SET password_hash = ?, must_change_password = 0,
           token_version = token_version + 1, updated_at = ? WHERE id = ?""",
        (hash_password(body.new_password), now, user["id"]),
    )
    audit(conn, user["id"], "password_changed", {"invalidated_sessions": True})
    user2 = get_user_by_id(conn, user["id"])
    token = create_token(user2)
    conn.close()
    return {
        "ok": True,
        "message": "تم تغيير كلمة المرور وإبطال الجلسات السابقة",
        "access_token": token,
        "user": user_public(user2),
    }


@app.get("/auth/me")
def me(user: sqlite3.Row = Depends(current_user)):
    return user_public(user)


# ---------- Admin: users ----------
@app.get("/admin/users")
def list_users(admin: sqlite3.Row = Depends(require_admin)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, email, full_name, role, active, must_change_password, created_at FROM users WHERE role != 'admin' ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@app.post("/admin/users/{user_id}/deactivate")
def deactivate_user(user_id: str, admin: sqlite3.Row = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "لا يمكن تعطيل حسابك")
    conn = get_conn()
    target = get_user_by_id(conn, user_id)
    if not target:
        conn.close()
        raise HTTPException(404, "غير موجود")
    if target["role"] == "admin":
        conn.close()
        raise HTTPException(400, "لا يمكن تعطيل مدير")
    conn.execute(
        "UPDATE users SET active = 0, token_version = token_version + 1, updated_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), user_id),
    )
    audit(conn, admin["id"], "user_deactivate", {"target": user_id})
    conn.close()
    return {"ok": True}


@app.post("/admin/users/{user_id}/reactivate")
def reactivate_user(user_id: str, admin: sqlite3.Row = Depends(require_admin)):
    conn = get_conn()
    conn.execute(
        "UPDATE users SET active = 1, updated_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), user_id),
    )
    audit(conn, admin["id"], "user_reactivate", {"target": user_id})
    conn.close()
    return {"ok": True}


@app.get("/admin/audit")
def get_audit(admin: sqlite3.Row = Depends(require_admin), limit: int = 100):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM audit_log ORDER BY id DESC LIMIT ?", (min(limit, 500),)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- User private data ----------
@app.post("/me/dataset")
def save_my_dataset(payload: dict, user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    conn.execute(
        "INSERT INTO user_datasets (user_id, label, source, payload, created_at) VALUES (?, ?, ?, ?, ?)",
        (
            user["id"],
            payload.get("label"),
            payload.get("source", "user"),
            json.dumps(payload, ensure_ascii=False),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    audit(conn, user["id"], "dataset_save", {"label": payload.get("label")})
    conn.close()
    return {"ok": True}


@app.get("/me/dataset")
def get_my_dataset(user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    row = conn.execute(
        "SELECT payload, created_at FROM user_datasets WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user["id"],),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return json.loads(row["payload"])


@app.post("/me/analysis")
def save_my_analysis(payload: dict, user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    conn.execute(
        "INSERT INTO user_analyses (user_id, payload, created_at) VALUES (?, ?, ?)",
        (user["id"], json.dumps(payload, ensure_ascii=False), datetime.now(timezone.utc).isoformat()),
    )
    conn.close()
    return {"ok": True}


@app.get("/me/analysis")
def get_my_analysis(user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    row = conn.execute(
        "SELECT payload FROM user_analyses WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user["id"],),
    ).fetchone()
    conn.close()
    return json.loads(row["payload"]) if row else None


@app.post("/me/reports")
def save_my_report(payload: dict, user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    conn.execute(
        "INSERT INTO user_reports (user_id, title, payload, created_at) VALUES (?, ?, ?, ?)",
        (
            user["id"],
            payload.get("title", "report"),
            json.dumps(payload, ensure_ascii=False),
            datetime.now(timezone.utc).isoformat(),
        ),
    )
    conn.close()
    return {"ok": True}


# ---------- Central data (admin write) ----------
@app.put("/admin/central/{key}")
def put_central(key: str, payload: dict, admin: sqlite3.Row = Depends(require_admin)):
    conn = get_conn()
    conn.execute(
        """INSERT INTO central_data (key, payload, updated_by, updated_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, updated_by = excluded.updated_by, updated_at = excluded.updated_at""",
        (key, json.dumps(payload, ensure_ascii=False), admin["id"], datetime.now(timezone.utc).isoformat()),
    )
    audit(conn, admin["id"], "central_put", {"key": key})
    conn.close()
    return {"ok": True}


@app.get("/central/{key}")
def get_central(key: str, user: sqlite3.Row = Depends(current_user)):
    conn = get_conn()
    row = conn.execute("SELECT payload FROM central_data WHERE key = ?", (key,)).fetchone()
    conn.close()
    return json.loads(row["payload"]) if row else None


@app.delete("/admin/central/{key}")
def delete_central(key: str, admin: sqlite3.Row = Depends(require_admin)):
    conn = get_conn()
    conn.execute("DELETE FROM central_data WHERE key = ?", (key,))
    audit(conn, admin["id"], "central_delete", {"key": key})
    conn.close()
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
