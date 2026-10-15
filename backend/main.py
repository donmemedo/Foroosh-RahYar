"""Tavanfroosh API: sales content library, approval workflow, analytics.

Security model (details in SECURITY_REPORT.md):
- Public: health, plans, demo form, login, and revocable share links (/api/s/<token>).
- Everything else needs the signed, HttpOnly `sid` cookie set by /api/login.
- Roles come from AUTH_USERS: "rep" reads, uploads, versions and shares approved items;
  "admin" also approves, deletes and opens pending files.
"""
import hashlib
import hmac
import os
import random
import re
import secrets
import shutil
import sqlite3
import sys
import threading
import time
import uuid
from collections import defaultdict, deque
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi import Path as PathParam
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field

DATA = Path(os.getenv("DATA_DIR", Path(__file__).parent / "data"))
UPLOADS = DATA / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
DB = DATA / "app.db"
# Next's /api rewrite buffers at most proxyClientMaxBodySize (next.config.ts); keep the two in step.
MAX_UPLOAD = 10 * 1024 * 1024
MAX_BODY = MAX_UPLOAD + 64 * 1024  # file + multipart overhead
CATEGORIES = {"deck", "catalog", "video", "case", "pricing", "playbook"}
OOXML = b"PK\x03\x04"
# Upload allow-list: extension -> (served media type, magic bytes, offset). Nothing a browser would execute.
FILE_TYPES = {
    ".pdf": ("application/pdf", b"%PDF-", 0),
    ".pptx": ("application/vnd.openxmlformats-officedocument.presentationml.presentation", OOXML, 0),
    ".docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", OOXML, 0),
    ".xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", OOXML, 0),
    ".mp4": ("video/mp4", b"ftyp", 4),
    ".png": ("image/png", b"\x89PNG\r\n\x1a\n", 0),
    ".jpg": ("image/jpeg", b"\xff\xd8\xff", 0),
    ".jpeg": ("image/jpeg", b"\xff\xd8\xff", 0),
    ".webp": ("image/webp", b"WEBP", 8),
}

# --- Auth -------------------------------------------------------------------------------------

SECRET = os.getenv("SECRET_KEY", "").encode() or secrets.token_bytes(32)  # unset: sessions end on restart
SESSION_TTL = 8 * 3600
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "1") != "0"


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1)
    return f"scrypt.{salt.hex()}.{digest.hex()}"


def check_password(password: str, stored: str) -> bool:
    try:
        return hmac.compare_digest(hash_password(password, bytes.fromhex(stored.split(".")[1])), stored)
    except (IndexError, ValueError):
        return False


def load_users(raw: str) -> dict[str, tuple[str, str]]:
    """AUTH_USERS="alice:admin:scrypt.<salt>.<hash> bob:rep:scrypt.<salt>.<hash>" (space, ; or newline separated)."""
    users = {}
    for entry in filter(None, re.split(r"[\s;]+", raw.strip())):
        name, _, rest = entry.partition(":")
        role, _, stored = rest.partition(":")
        if re.fullmatch(r"[\w.-]{1,40}", name) and role in ("admin", "rep") and stored.startswith("scrypt."):
            users[name] = (role, stored)
        else:
            print(f"AUTH_USERS: ignoring malformed entry for {name!r}", file=sys.stderr)
    return users


USERS = load_users(os.getenv("AUTH_USERS", ""))
DUMMY_HASH = hash_password(secrets.token_hex(8))  # unknown users cost the same as known ones (no user enumeration)


def sign(value: str) -> str:
    return hmac.new(SECRET, value.encode(), hashlib.sha256).hexdigest()


def current_user(request: Request) -> dict:
    try:
        user, exp, sig = request.cookies.get("sid", "").split("|")
        ok = hmac.compare_digest(sig, sign(f"{user}|{exp}")) and int(exp) > time.time() and user in USERS
    except ValueError:
        ok = False
    if not ok:
        raise HTTPException(401, "Login required")
    return {"user": user, "role": USERS[user][0]}  # role read from config, never from the cookie


def require_admin(u: dict = Depends(current_user)) -> dict:
    if u["role"] != "admin":
        raise HTTPException(403, "Admin only")
    return u


User = Annotated[dict, Depends(current_user)]
Admin = Annotated[dict, Depends(require_admin)]
Cid = Annotated[str, PathParam(pattern=r"^[0-9a-f]{10,32}$")]
Token = Annotated[str, PathParam(pattern=r"^[\w-]{20,40}$")]

# --- Rate limiting ----------------------------------------------------------------------------

_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def limited(key: str, limit: int, window: int) -> bool:
    """Sliding window: True once `key` has `limit` hits inside `window` seconds."""
    # ponytail: in-process memory, correct for one uvicorn worker. Move to Redis before running several.
    t = time.monotonic()
    with _hits_lock:
        if len(_hits) > 20_000:  # bound memory when keys are attacker-chosen (spoofed IPs, usernames)
            for k in [k for k, q in _hits.items() if not q or q[-1] < t - 3600]:
                del _hits[k]
            if len(_hits) > 50_000:
                _hits.clear()
        q = _hits[key]
        while q and q[0] <= t - window:
            q.popleft()
        if len(q) >= limit:
            return True
        q.append(t)
        return False


def rate(key: str, limit: int, window: int) -> None:
    if limited(key, limit, window):
        raise HTTPException(429, "Too many requests, try again later", headers={"Retry-After": str(window)})


def ip(request: Request) -> str:
    # uvicorn rewrites request.client from X-Forwarded-For only for FORWARDED_ALLOW_IPS peers.
    # Next keeps a client-sent X-Forwarded-For, so IP keys are spoofable without a reverse proxy
    # that overwrites it; limits that matter are therefore keyed on user or username too.
    return request.client.host if request.client else "?"


# --- App + edge guard -------------------------------------------------------------------------

DOCS = os.getenv("ENABLE_DOCS") == "1"
app = FastAPI(title="Tavanfroosh API", version="1.1", docs_url="/docs" if DOCS else None, redoc_url=None,
              openapi_url="/openapi.json" if DOCS else None)

SECURITY_HEADERS = {
    b"x-content-type-options": b"nosniff",
    b"x-frame-options": b"DENY",
    b"referrer-policy": b"no-referrer",
    b"cross-origin-resource-policy": b"same-origin",
    b"content-security-policy": b"default-src 'none'; frame-ancestors 'none'; sandbox",
    b"cache-control": b"no-store",
}


class EdgeGuard:
    """Pure ASGI (no BaseHTTPMiddleware overhead): blocks cross-site writes, caps request bodies,
    adds security headers. Runs before routing, so rejected requests cost almost nothing."""

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.inner(scope, receive, send)
        h = dict(scope["headers"])
        # CSRF: browsers send Sec-Fetch-Site; forms/no-cors fetches from other sites carry "cross-site".
        if scope["method"] not in ("GET", "HEAD", "OPTIONS") and h.get(b"sec-fetch-site", b"same-origin") not in (b"same-origin", b"none"):
            return await JSONResponse({"detail": "Cross-site request blocked"}, 403)(scope, receive, send)
        length = h.get(b"content-length", b"0")
        if not length.isdigit() or int(length) > MAX_BODY:
            return await JSONResponse({"detail": "Request too large"}, 413)(scope, receive, send)
        seen = 0

        async def capped_receive():  # also catches chunked bodies that send no Content-Length
            nonlocal seen
            message = await receive()
            seen += len(message.get("body", b""))
            if seen > MAX_BODY:
                raise HTTPException(413, "Request too large")
            return message

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                present = {k.lower() for k, _ in message.get("headers", [])}
                message["headers"] = list(message.get("headers", [])) + [(k, v) for k, v in SECURITY_HEADERS.items() if k not in present]
            await send(message)

        await self.inner(scope, capped_receive, send_with_headers)


app.add_middleware(EdgeGuard)

# --- Database ---------------------------------------------------------------------------------


@contextmanager
def db():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        with con:  # commit on success, roll back on error
            yield con
    finally:
        con.close()  # the sqlite context manager alone never closes


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


SEED = [
    ("Q3 Product Deck", "ارائه محصول فصل سوم", "deck", 12.4),
    ("Pharma Catalog 1405", "کاتالوگ دارویی ۱۴۰۵", "catalog", 28.1),
    ("Demo Walkthrough", "ویدیوی معرفی محصول", "video", 184.0),
    ("Distribution Case Study", "مطالعه موردی صنعت پخش", "case", 3.2),
    ("Enterprise Price Sheet", "فهرست قیمت سازمانی", "pricing", 0.8),
    ("Field Sales Playbook", "راهنمای فروش میدانی", "playbook", 5.6),
    ("Medical Devices Brochure", "بروشور تجهیزات پزشکی", "catalog", 9.3),
    ("Banking & Insurance Pitch", "ارائه بانک و بیمه", "deck", 7.7),
    ("Security Checklist", "چک‌لیست امنیت", "playbook", 1.1),
]


def init():
    with db() as con:
        con.execute("PRAGMA journal_mode=WAL")  # readers no longer block on writers (persistent setting)
        con.executescript("""
        CREATE TABLE IF NOT EXISTS content(id TEXT PRIMARY KEY, title_en TEXT, title_fa TEXT, category TEXT,
          status TEXT, version INTEGER, size_mb REAL, file TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS versions(content_id TEXT, version INTEGER, note TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS events(content_id TEXT, type TEXT, ts TEXT);
        CREATE TABLE IF NOT EXISTS demo_requests(name TEXT, company TEXT, phone TEXT, team_size INTEGER, created_at TEXT);
        CREATE TABLE IF NOT EXISTS shares(token TEXT PRIMARY KEY, content_id TEXT, created_at TEXT);
        CREATE INDEX IF NOT EXISTS ev_ct ON events(content_id, type);
        CREATE INDEX IF NOT EXISTS ev_tt ON events(ts, type);
        CREATE INDEX IF NOT EXISTS content_updated ON content(updated_at);
        CREATE INDEX IF NOT EXISTS shares_content ON shares(content_id);
        DELETE FROM versions WHERE rowid NOT IN (SELECT MIN(rowid) FROM versions GROUP BY content_id, version);
        CREATE UNIQUE INDEX IF NOT EXISTS versions_uq ON versions(content_id, version);
        """)
        if os.getenv("SEED_DEMO") == "1" and not con.execute("SELECT 1 FROM content").fetchone():
            rnd = random.Random(1405)  # deterministic demo data, not security-relevant
            today = datetime.now(timezone.utc)
            for i, (en, fa, cat, size) in enumerate(SEED):
                cid = uuid.uuid4().hex[:10]
                ver = rnd.randint(1, 4)
                status = "pending" if i in (2, 5) else "approved"
                con.execute("INSERT INTO content VALUES(?,?,?,?,?,?,?,?,?)",
                            (cid, en, fa, cat, status, ver, size, None, (today - timedelta(days=i)).isoformat(timespec="seconds")))
                for v in range(1, ver + 1):
                    con.execute("INSERT INTO versions VALUES(?,?,?,?)", (cid, v, "Initial upload" if v == 1 else f"Revision {v}",
                                (today - timedelta(days=30 - v * 5)).isoformat(timespec="seconds")))
                weight = rnd.uniform(0.4, 1.6)
                for d in range(30):
                    day = (today - timedelta(days=d)).isoformat(timespec="seconds")
                    con.executemany("INSERT INTO events VALUES(?,?,?)",
                                    [(cid, "view", day)] * int(rnd.randint(2, 9) * weight) + [(cid, "share", day)] * int(rnd.randint(0, 3) * weight))


init()
if not USERS:
    print("AUTH_USERS is empty: nobody can log in. Create a hash with `python main.py hash-password`.", file=sys.stderr)

ROW = """SELECT c.*, (SELECT COUNT(*) FROM events e WHERE e.content_id=c.id AND e.type='view') views,
  (SELECT COUNT(*) FROM events e WHERE e.content_id=c.id AND e.type='share') shares FROM content c"""


def get_or_404(con, cid, counts=True):
    row = con.execute(ROW + " WHERE c.id=?" if counts else "SELECT * FROM content WHERE id=?", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Content not found")
    return dict(row)


_analytics = {"at": -1e9, "data": None}
ANALYTICS_TTL = 30  # seconds; views/shares tolerate this staleness, content edits bust it


def bust():
    _analytics["at"] = -1e9


# --- Routes -----------------------------------------------------------------------------------


@app.get("/api/health")
def health():
    with db() as con:
        con.execute("SELECT 1")
    if not os.access(DATA, os.W_OK):  # e.g. a root-owned volume after switching to a non-root user
        return JSONResponse({"ok": False, "detail": "data dir not writable"}, 503)
    return {"ok": True}


class LoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=40)
    password: str = Field(min_length=1, max_length=200)


@app.post("/api/login")
def login(body: LoginIn, request: Request, response: Response):
    rate(f"login-ip:{ip(request)}", 20, 300)
    rate(f"login-user:{body.username}", 10, 300)  # holds even when the IP is spoofed
    role, stored = USERS.get(body.username, (None, DUMMY_HASH))
    if not check_password(body.password, stored) or role is None:
        raise HTTPException(401, "Invalid username or password")
    value = f"{body.username}|{int(time.time()) + SESSION_TTL}"
    response.set_cookie("sid", f"{value}|{sign(value)}", max_age=SESSION_TTL, path="/api",
                        httponly=True, secure=COOKIE_SECURE, samesite="strict")
    return {"user": body.username, "role": role}


@app.post("/api/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie("sid", path="/api", httponly=True, secure=COOKIE_SECURE, samesite="strict")


@app.get("/api/me")
def me(request: Request):
    try:
        return current_user(request)
    except HTTPException:
        return {"user": None, "role": None}


@app.get("/api/content")
def list_content(u: User, q: str = Query("", max_length=100), category: str = Query("", max_length=20),
                 status: str = Query("", max_length=20)):
    sql, args = ROW + " WHERE 1=1", []
    if q:
        sql += " AND (c.title_en LIKE ? OR c.title_fa LIKE ?)"
        args += [f"%{q}%"] * 2
    if category:
        sql += " AND c.category=?"
        args.append(category)
    if status:
        sql += " AND c.status=?"
        args.append(status)
    with db() as con:
        # ponytail: hard cap instead of pagination; add offset/cursor when a library outgrows 500 items.
        return [dict(r) for r in con.execute(sql + " ORDER BY c.updated_at DESC LIMIT 500", args)]


@app.get("/api/content/{cid}")
def get_content(cid: Cid, u: User):
    with db() as con:
        item = get_or_404(con, cid)
        item["versions"] = [dict(r) for r in con.execute("SELECT version, note, created_at FROM versions WHERE content_id=? ORDER BY version DESC", (cid,))]
        return item


@app.post("/api/content", status_code=201)
def create_content(u: User, title_en: str = Form(..., min_length=1, max_length=120), title_fa: str = Form(..., min_length=1, max_length=120),
                   category: str = Form(...), file: UploadFile | None = File(None)):
    # Plain def: FastAPI runs it in the threadpool, so disk and sqlite I/O never block the event loop.
    rate(f"upload:{u['user']}", 30, 3600)
    if category not in CATEGORIES:
        raise HTTPException(422, "Invalid category")
    cid, fname, size = secrets.token_hex(16), None, 0.0
    if file and file.filename:
        ext = Path(file.filename).suffix.lower()
        kind = FILE_TYPES.get(ext)
        head = file.file.read(16)
        if not kind or head[kind[2]:kind[2] + len(kind[1])] != kind[1]:
            raise HTTPException(415, "Unsupported file type. Allowed: " + ", ".join(FILE_TYPES))
        file.file.seek(0)
        fname = cid + ext
        with open(UPLOADS / fname, "wb") as out:  # streamed in 1 MB chunks, never fully in memory
            shutil.copyfileobj(file.file, out, 1 << 20)
            nbytes = out.tell()
        if nbytes > MAX_UPLOAD:
            (UPLOADS / fname).unlink(missing_ok=True)
            raise HTTPException(413, "File too large (max 10MB)")
        size = round(nbytes / 1048576, 2)
    with db() as con:
        con.execute("INSERT INTO content VALUES(?,?,?,?,?,?,?,?,?)", (cid, title_en, title_fa, category, "pending", 1, size, fname, now()))
        con.execute("INSERT INTO versions VALUES(?,?,?,?)", (cid, 1, "Initial upload", now()))
        bust()
        return get_or_404(con, cid)


class VersionIn(BaseModel):
    note: str = Field(min_length=1, max_length=200)


@app.post("/api/content/{cid}/versions")
def new_version(cid: Cid, body: VersionIn, u: User):
    with db() as con:
        get_or_404(con, cid, counts=False)
        # Increment in SQL inside one write transaction: concurrent calls cannot reuse a version number.
        con.execute("UPDATE content SET version=version+1, status='pending', updated_at=? WHERE id=?", (now(), cid))
        con.execute("INSERT INTO versions SELECT id, version, ?, ? FROM content WHERE id=?", (body.note, now(), cid))
        bust()
        return get_or_404(con, cid)


@app.post("/api/content/{cid}/approve")
def approve(cid: Cid, u: Admin):
    with db() as con:
        get_or_404(con, cid, counts=False)
        con.execute("UPDATE content SET status='approved', updated_at=? WHERE id=?", (now(), cid))
        bust()
        return get_or_404(con, cid)


@app.post("/api/content/{cid}/share", status_code=201)
def share(cid: Cid, u: User):
    """A share is a revocable link token for an approved item. The token, not the internal id, goes to customers."""
    rate(f"share:{u['user']}", 60, 60)
    with db() as con:
        if get_or_404(con, cid, counts=False)["status"] != "approved":
            raise HTTPException(409, "Only approved content can be shared")
        token = secrets.token_urlsafe(16)
        con.execute("INSERT INTO shares VALUES(?,?,?)", (token, cid, now()))
        con.execute("INSERT INTO events VALUES(?,?,?)", (cid, "share", now()))
    return {"token": token}


@app.delete("/api/content/{cid}/shares", status_code=204)
def revoke_shares(cid: Cid, u: Admin):
    with db() as con:
        get_or_404(con, cid, counts=False)
        con.execute("DELETE FROM shares WHERE content_id=?", (cid,))


SHARED = """SELECT c.id, c.title_en, c.title_fa, c.category, c.version, c.file, c.updated_at
  FROM shares s JOIN content c ON c.id=s.content_id WHERE s.token=? AND c.status='approved'"""


def shared_or_404(con, token, request):
    rate(f"shared:{ip(request)}", 120, 60)
    row = con.execute(SHARED, (token,)).fetchone()
    if not row:  # unknown, revoked, or the item went back to pending: the approval gate holds for links too
        raise HTTPException(404, "Link not found or no longer available")
    return dict(row)


@app.get("/api/s/{token}")
def shared(token: Token, request: Request):
    with db() as con:
        item = shared_or_404(con, token, request)
        if not limited(f"view:{token}:{ip(request)}", 1, 1800):  # a reload is not a new view
            con.execute("INSERT INTO events VALUES(?,?,?)", (item["id"], "view", now()))
    return {k: item[k] for k in ("title_en", "title_fa", "category", "version", "updated_at")} | {"has_file": bool(item["file"])}


@app.get("/api/s/{token}/file")
def shared_file(token: Token, request: Request):
    with db() as con:
        return send_file(shared_or_404(con, token, request))


@app.get("/api/content/{cid}/file")
def download(cid: Cid, u: User):
    with db() as con:
        item = get_or_404(con, cid, counts=False)
    if item["status"] != "approved" and u["role"] != "admin":
        raise HTTPException(409, "Not approved yet")
    return send_file(item)


def send_file(item):
    if not item["file"]:
        raise HTTPException(404, "No file attached")
    ext = Path(item["file"]).suffix.lower()
    media = FILE_TYPES.get(ext, ("application/octet-stream",))[0]  # legacy uploads outside the allow-list stay inert
    name = re.sub(r"[^\w\- ]+", "_", item["title_en"]).strip()[:80] or "download"
    return FileResponse(UPLOADS / item["file"], media_type=media, filename=name + ext)  # attachment by default


@app.delete("/api/content/{cid}", status_code=204)
def delete(cid: Cid, u: Admin):
    with db() as con:
        item = get_or_404(con, cid, counts=False)
        for t in ("events", "versions", "shares"):
            con.execute(f"DELETE FROM {t} WHERE content_id=?", (cid,))  # t is a fixed literal, not input
        con.execute("DELETE FROM content WHERE id=?", (cid,))
        bust()
    if item["file"]:
        (UPLOADS / item["file"]).unlink(missing_ok=True)


@app.get("/api/analytics")
def analytics(u: User):
    if time.monotonic() - _analytics["at"] < ANALYTICS_TTL:
        return _analytics["data"]
    today = datetime.now(timezone.utc).date()
    days = [(today - timedelta(days=i)).isoformat() for i in range(29, -1, -1)]
    with db() as con:
        daily = {r["d"]: r for r in con.execute(
            "SELECT substr(ts,1,10) d, SUM(type='view') views, SUM(type='share') shares FROM events WHERE ts>=? GROUP BY d", (days[0],))}
        content = con.execute("SELECT COUNT(*) n, COALESCE(SUM(status='pending'), 0) pending FROM content").fetchone()
        # ponytail: whole-table count, cheap behind the 30 s cache; add counter columns if events reach tens of millions.
        totals = con.execute("SELECT COALESCE(SUM(type='view'), 0) views, COALESCE(SUM(type='share'), 0) shares FROM events").fetchone()
        top = [dict(r) for r in con.execute(ROW + " ORDER BY views DESC LIMIT 5")]
        cats = [dict(r) for r in con.execute(
            "SELECT c.category, COUNT(e.content_id) views FROM content c LEFT JOIN events e ON e.content_id=c.id AND e.type='view' "
            "GROUP BY c.category ORDER BY views DESC")]
        recent = [dict(r) for r in con.execute(
            "SELECT e.type, e.ts, c.title_en, c.title_fa FROM events e JOIN content c ON c.id=e.content_id ORDER BY e.ts DESC LIMIT 8")]
    views, shares = totals["views"], totals["shares"]
    data = {
        "kpis": {"content": content["n"], "views": views, "shares": shares, "pending": content["pending"],
                 "share_rate": round(shares / views * 100, 1) if views else 0},
        "series": [{"date": d, "views": daily[d]["views"] if d in daily else 0, "shares": daily[d]["shares"] if d in daily else 0} for d in days],
        "top": top,
        "categories": cats,
        "recent": recent,
    }
    _analytics.update(at=time.monotonic(), data=data)
    return data


PLANS = [
    {"id": "professional", "price": 900_000, "unit": "user", "features": ["library", "mobile", "search", "analytics_basic"]},
    {"id": "premium", "price": 1_200_000, "unit": "user", "popular": True, "features": ["library", "mobile", "search", "workflow", "analytics_full", "crm"]},
    {"id": "enterprise", "price": 60_000_000, "unit": "org", "features": ["everything", "private_cloud", "sso", "sla", "onboarding"]},
]


@app.get("/api/plans")
def plans():
    return PLANS


class DemoIn(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    company: str = Field(min_length=2, max_length=120)
    phone: str = Field(pattern=r"^[0-9+\-\s۰-۹]{8,20}$")
    team_size: int = Field(ge=1, le=100_000)


@app.post("/api/demo", status_code=201)
def demo(body: DemoIn, request: Request):
    rate(f"demo:{ip(request)}", 5, 3600)
    rate("demo:all", 300, 3600)  # backstop when the per-IP key is spoofed
    with db() as con:
        con.execute("INSERT INTO demo_requests VALUES(?,?,?,?,?)", (body.name, body.company, body.phone, body.team_size, now()))
    return {"ok": True}


if __name__ == "__main__" and sys.argv[1:] == ["hash-password"]:
    import getpass

    print(hash_password(getpass.getpass("Password: ")))
