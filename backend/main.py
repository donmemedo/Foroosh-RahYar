"""Showpad Iran (Tavanfroosh) API — sales content library, approval workflow, analytics."""
import os
import random
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DATA = Path(os.getenv("DATA_DIR", Path(__file__).parent / "data"))
UPLOADS = DATA / "uploads"
UPLOADS.mkdir(parents=True, exist_ok=True)
DB = DATA / "app.db"
MAX_UPLOAD = 50 * 1024 * 1024
CATEGORIES = {"deck", "catalog", "video", "case", "pricing", "playbook"}

app = FastAPI(title="Showpad Iran API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS_ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


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
    con = db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS content(id TEXT PRIMARY KEY, title_en TEXT, title_fa TEXT, category TEXT,
      status TEXT, version INTEGER, size_mb REAL, file TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS versions(content_id TEXT, version INTEGER, note TEXT, created_at TEXT);
    CREATE TABLE IF NOT EXISTS events(content_id TEXT, type TEXT, ts TEXT);
    CREATE TABLE IF NOT EXISTS demo_requests(name TEXT, company TEXT, phone TEXT, team_size INTEGER, created_at TEXT);
    """)
    if not con.execute("SELECT 1 FROM content").fetchone():
        rnd = random.Random(1405)  # deterministic demo data
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
                day = today - timedelta(days=d)
                for _ in range(int(rnd.randint(2, 9) * weight)):
                    con.execute("INSERT INTO events VALUES(?,?,?)", (cid, "view", day.isoformat(timespec="seconds")))
                for _ in range(int(rnd.randint(0, 3) * weight)):
                    con.execute("INSERT INTO events VALUES(?,?,?)", (cid, "share", day.isoformat(timespec="seconds")))
    con.commit()
    con.close()


init()

ROW = """SELECT c.*, (SELECT COUNT(*) FROM events e WHERE e.content_id=c.id AND e.type='view') views,
  (SELECT COUNT(*) FROM events e WHERE e.content_id=c.id AND e.type='share') shares FROM content c"""


def get_or_404(con, cid):
    row = con.execute(ROW + " WHERE c.id=?", (cid,)).fetchone()
    if not row:
        raise HTTPException(404, "Content not found")
    return dict(row)


@app.get("/api/health")
def health():
    return {"ok": True}


@app.get("/api/content")
def list_content(q: str = "", category: str = "", status: str = ""):
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
        return [dict(r) for r in con.execute(sql + " ORDER BY c.updated_at DESC", args)]


@app.get("/api/content/{cid}")
def get_content(cid: str):
    with db() as con:
        item = get_or_404(con, cid)
        item["versions"] = [dict(r) for r in con.execute("SELECT version, note, created_at FROM versions WHERE content_id=? ORDER BY version DESC", (cid,))]
        return item


@app.post("/api/content", status_code=201)
async def create_content(title_en: str = Form(..., min_length=1, max_length=120), title_fa: str = Form(..., min_length=1, max_length=120),
                         category: str = Form(...), file: UploadFile | None = File(None)):
    if category not in CATEGORIES:
        raise HTTPException(422, "Invalid category")
    cid, fname, size = uuid.uuid4().hex[:10], None, 0.0
    if file and file.filename:
        blob = await file.read(MAX_UPLOAD + 1)
        if len(blob) > MAX_UPLOAD:
            raise HTTPException(413, "File too large (max 50MB)")
        fname = cid + Path(file.filename).suffix[:10]
        (UPLOADS / fname).write_bytes(blob)
        size = round(len(blob) / 1048576, 2)
    with db() as con:
        con.execute("INSERT INTO content VALUES(?,?,?,?,?,?,?,?,?)", (cid, title_en, title_fa, category, "pending", 1, size, fname, now()))
        con.execute("INSERT INTO versions VALUES(?,?,?,?)", (cid, 1, "Initial upload", now()))
        return get_or_404(con, cid)


class VersionIn(BaseModel):
    note: str = Field(min_length=1, max_length=200)


@app.post("/api/content/{cid}/versions")
def new_version(cid: str, body: VersionIn):
    with db() as con:
        item = get_or_404(con, cid)
        con.execute("UPDATE content SET version=?, status='pending', updated_at=? WHERE id=?", (item["version"] + 1, now(), cid))
        con.execute("INSERT INTO versions VALUES(?,?,?,?)", (cid, item["version"] + 1, body.note, now()))
        return get_or_404(con, cid)


@app.post("/api/content/{cid}/approve")
def approve(cid: str):
    with db() as con:
        get_or_404(con, cid)
        con.execute("UPDATE content SET status='approved', updated_at=? WHERE id=?", (now(), cid))
        return get_or_404(con, cid)


@app.post("/api/content/{cid}/events/{kind}")
def track(cid: str, kind: str):
    if kind not in ("view", "share"):
        raise HTTPException(422, "kind must be view or share")
    with db() as con:
        get_or_404(con, cid)
        con.execute("INSERT INTO events VALUES(?,?,?)", (cid, kind, now()))
        return get_or_404(con, cid)


@app.get("/api/content/{cid}/file")
def download(cid: str):
    with db() as con:
        item = get_or_404(con, cid)
    if not item["file"]:
        raise HTTPException(404, "No file attached")
    return FileResponse(UPLOADS / item["file"], filename=item["title_en"] + Path(item["file"]).suffix)


@app.delete("/api/content/{cid}", status_code=204)
def delete(cid: str):
    with db() as con:
        item = get_or_404(con, cid)
        for t in ("events", "versions"):
            con.execute(f"DELETE FROM {t} WHERE content_id=?", (cid,))
        con.execute("DELETE FROM content WHERE id=?", (cid,))
    if item["file"]:
        (UPLOADS / item["file"]).unlink(missing_ok=True)


@app.get("/api/analytics")
def analytics():
    with db() as con:
        since = (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
        daily = {r["d"]: dict(r) for r in con.execute(
            "SELECT substr(ts,1,10) d, SUM(type='view') views, SUM(type='share') shares FROM events WHERE ts>=? GROUP BY d", (since,))}
        days = [(datetime.now(timezone.utc) - timedelta(days=i)).date().isoformat() for i in range(29, -1, -1)]
        series = [{"date": d, "views": daily.get(d, {}).get("views", 0), "shares": daily.get(d, {}).get("shares", 0)} for d in days]
        items = [dict(r) for r in con.execute(ROW)]
        cats = {}
        for it in items:
            cats[it["category"]] = cats.get(it["category"], 0) + it["views"]
        recent = [dict(r) for r in con.execute(
            "SELECT e.type, e.ts, c.title_en, c.title_fa FROM events e JOIN content c ON c.id=e.content_id ORDER BY e.ts DESC, e.rowid DESC LIMIT 8")]
    views, shares = sum(i["views"] for i in items), sum(i["shares"] for i in items)
    return {
        "kpis": {"content": len(items), "views": views, "shares": shares,
                 "pending": sum(i["status"] == "pending" for i in items),
                 "share_rate": round(shares / views * 100, 1) if views else 0},
        "series": series,
        "top": sorted(items, key=lambda i: i["views"], reverse=True)[:5],
        "categories": [{"category": k, "views": v} for k, v in sorted(cats.items(), key=lambda kv: -kv[1])],
        "recent": recent,
    }


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
def demo(body: DemoIn):
    with db() as con:
        con.execute("INSERT INTO demo_requests VALUES(?,?,?,?,?)", (body.name, body.company, body.phone, body.team_size, now()))
    return {"ok": True}
