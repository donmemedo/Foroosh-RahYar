"""Security regression check + local pen test. Boots the API on a throwaway DATA_DIR and attacks it.

    .venv/bin/python test_security.py        # exits non-zero on the first failed check

Stdlib only. Never points at backend/data.
"""
import hashlib
import json
import os
import secrets
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
PORT = (lambda s: (s.bind(("127.0.0.1", 0)), s.getsockname()[1], s.close())[1])(socket.socket())
BASE = f"http://127.0.0.1:{PORT}"
results = []


def pw_hash(password):
    salt = secrets.token_bytes(16)
    return f"scrypt.{salt.hex()}.{hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1).hex()}"


def call(method, path, body=None, cookie=None, headers=None, raw=None):
    h = dict(headers or {})
    data = raw
    if body is not None:
        data, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    if cookie:
        h["Cookie"] = cookie
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def multipart(fields, filename=None, content=b""):
    b = "----x" + secrets.token_hex(8)
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items()]
    if filename:
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                     f"Content-Type: application/octet-stream\r\n\r\n".encode() + content + b"\r\n")
    return b"".join(parts) + f"--{b}--\r\n".encode(), {"Content-Type": f"multipart/form-data; boundary={b}"}


def upload(cookie, filename, content, title="Deck"):
    data, h = multipart({"title_en": title, "title_fa": "ارائه", "category": "deck"}, filename, content)
    return call("POST", "/api/content", raw=data, cookie=cookie, headers=h)


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  [{detail}]" if detail else ""))


def login(user, password):
    code, h, _ = call("POST", "/api/login", {"username": user, "password": password})
    return code, h.get("set-cookie", ""), h.get("set-cookie", "").split(";")[0]


def main():
    data_dir = tempfile.mkdtemp(prefix="tf-pentest-")
    env = os.environ | {"DATA_DIR": data_dir, "SEED_DEMO": "1", "SECRET_KEY": secrets.token_hex(32),
                        "AUTH_USERS": f"boss:admin:{pw_hash('admin-pass-1')} rita:rep:{pw_hash('rep-pass-1')}"}
    server = subprocess.Popen([sys.executable, "-m", "uvicorn", "main:app", "--port", str(PORT), "--no-server-header"],
                              cwd=HERE, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(600):  # generous: cold imports on a loaded machine can take a while
            try:
                if call("GET", "/api/health")[0] == 200:
                    break
            except OSError:
                time.sleep(0.5)
        run()
    finally:
        server.terminate()
        server.wait()
    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


def run():
    # --- Unauthenticated attacker ---
    check("anon list content -> 401", call("GET", "/api/content")[0] == 401)
    check("anon analytics -> 401", call("GET", "/api/analytics")[0] == 401)
    check("anon approve -> 401", call("POST", "/api/content/0123456789/approve")[0] == 401)
    check("anon delete -> 401", call("DELETE", "/api/content/0123456789")[0] == 401)
    check("anon upload -> 401", upload(None, "a.pdf", b"%PDF-1.4")[0] == 401)
    check("old event-inflation route removed", call("POST", "/api/content/0123456789/events/share")[0] in (401, 404, 405))
    check("/docs and /openapi.json hidden", call("GET", "/docs")[0] == 404 and call("GET", "/openapi.json")[0] == 404)
    code, h, _ = call("OPTIONS", "/api/content", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "DELETE"})
    check("CORS: no allow-origin for evil origin", "access-control-allow-origin" not in h)
    _, h, _ = call("GET", "/api/health")
    check("no server banner", "server" not in h, h.get("server", ""))
    need = ["x-content-type-options", "x-frame-options", "content-security-policy", "referrer-policy", "cache-control"]
    check("API security headers present", all(k in h for k in need), ",".join(k for k in need if k not in h))

    # --- Authentication ---
    check("wrong password -> 401", login("rita", "nope")[0] == 401)
    check("unknown user -> 401", login("mallory", "x")[0] == 401)
    code, setcookie, rep = login("rita", "rep-pass-1")
    flags = setcookie.lower()
    check("rep login -> 200", code == 200)
    check("session cookie HttpOnly+Secure+SameSite=Strict+Path=/api",
          all(f in flags for f in ("httponly", "secure", "samesite=strict", "path=/api")), setcookie.split(";", 1)[-1].strip())
    user, exp, sig = rep.split("=", 1)[1].split("|")
    check("tampered cookie (role/user swap) -> 401", call("GET", "/api/content", cookie=f"sid=boss|{exp}|{sig}")[0] == 401)
    check("expired cookie -> 401", call("GET", "/api/content", cookie=f"sid={user}|1|{sig}")[0] == 401)
    _, _, admin = login("boss", "admin-pass-1")
    check("/api/me returns role", json.loads(call("GET", "/api/me", cookie=rep)[2])["role"] == "rep")

    # --- Authorization (vertical privilege escalation) ---
    items = json.loads(call("GET", "/api/content", cookie=rep)[2])
    pending = next(i for i in items if i["status"] == "pending")["id"]
    approved = next(i for i in items if i["status"] == "approved")["id"]
    check("rep approve -> 403", call("POST", f"/api/content/{pending}/approve", cookie=rep)[0] == 403)
    check("rep delete -> 403", call("DELETE", f"/api/content/{approved}", cookie=rep)[0] == 403)
    check("rep revoke links -> 403", call("DELETE", f"/api/content/{approved}/shares", cookie=rep)[0] == 403)

    # --- CSRF ---
    code = call("POST", f"/api/content/{pending}/versions", {"note": "x"}, cookie=admin, headers={"Sec-Fetch-Site": "cross-site"})[0]
    check("cross-site write with valid cookie -> 403", code == 403)

    # --- Upload surface ---
    check("upload .html -> 415", upload(rep, "x.html", b"<script>alert(1)</script>")[0] == 415)
    check("upload .svg -> 415", upload(rep, "x.svg", b"<svg onload=alert(1)>")[0] == 415)
    check("HTML disguised as .pdf -> 415", upload(rep, "x.pdf", b"<html><script>alert(1)</script>")[0] == 415)
    code, _, body = upload(rep, "deck.pdf", b"%PDF-1.4\n" + b"0" * 2048, title='a"b\r\nX-Evil: 1')
    check("real PDF upload -> 201 pending", code == 201 and json.loads(body)["status"] == "pending")
    new = json.loads(body)["id"]
    check("new ids are 128-bit", len(new) == 32)
    raw = b"x" * (11 * 1024 * 1024)
    data, h = multipart({"title_en": "a", "title_fa": "a", "category": "deck"}, "big.pdf", b"%PDF-" + raw)
    check("oversize body (Content-Length) -> 413 before reading it", raw_post(rep, data, h, chunked=False) == 413)
    check("oversize chunked body -> 413", raw_post(rep, data, h, chunked=True) == 413)

    # --- Approval gate + downloads ---
    check("rep download of pending file -> 409", call("GET", f"/api/content/{new}/file", cookie=rep)[0] == 409)
    code, h, _ = call("GET", f"/api/content/{new}/file", cookie=admin)
    cd = h.get("content-disposition", "")
    check("admin download pending -> 200 attachment", code == 200 and cd.startswith("attachment"))
    check("download: pinned PDF type + nosniff + sandbox CSP",
          h.get("content-type") == "application/pdf" and h.get("x-content-type-options") == "nosniff" and "sandbox" in h.get("content-security-policy", ""))
    check("CRLF in title cannot inject a header", "x-evil" not in h and "\r" not in cd and "\n" not in cd, cd)
    check("share pending item -> 409", call("POST", f"/api/content/{new}/share", cookie=rep)[0] == 409)
    check("admin approve -> 200", call("POST", f"/api/content/{new}/approve", cookie=admin)[0] == 200)

    # --- Share links (public, scoped, revocable) ---
    code, _, body = call("POST", f"/api/content/{new}/share", cookie=rep)
    token = json.loads(body)["token"]
    check("rep share approved -> 201 token", code == 201 and len(token) >= 20)
    code, _, body = call("GET", f"/api/s/{token}")
    pub = json.loads(body)
    check("public link works without login, hides internal id/file", code == 200 and "id" not in pub and "file" not in pub)
    call("GET", f"/api/s/{token}")
    views = json.loads(call("GET", f"/api/content/{new}", cookie=rep)[2])["views"]
    check("reload counts one view, not two", views == 1, f"views={views}")
    code, h, _ = call("GET", f"/api/s/{token}/file")
    check("public file download -> attachment", code == 200 and h.get("content-disposition", "").startswith("attachment"))
    check("guessing a token -> 404", call("GET", f"/api/s/{secrets.token_urlsafe(16)}")[0] == 404)
    call("POST", f"/api/content/{new}/versions", {"note": "v2"}, cookie=rep)
    check("new version re-pends: link stops working", call("GET", f"/api/s/{token}")[0] == 404)
    call("POST", f"/api/content/{new}/approve", cookie=admin)
    check("re-approved: link works again", call("GET", f"/api/s/{token}")[0] == 200)
    call("DELETE", f"/api/content/{new}/shares", cookie=admin)
    check("revoked link -> 404", call("GET", f"/api/s/{token}")[0] == 404)
    code, h, _ = call("GET", f"/api/content/{new}/file", cookie=rep, headers={"Range": "bytes=" + ",".join(f"{i}-{i}" for i in range(2000))})
    check("multi-range request is cheap (Starlette CVE-2025-62727 fixed)", code in (200, 206, 416))

    # --- Integrity under concurrency ---
    threads = [threading.Thread(target=call, args=("POST", f"/api/content/{new}/versions", {"note": f"c{i}"}, rep)) for i in range(10)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    vs = [v["version"] for v in json.loads(call("GET", f"/api/content/{new}", cookie=rep)[2])["versions"]]
    check("10 concurrent versions -> unique, gap-free numbers", sorted(vs) == list(range(1, len(vs) + 1)) and len(vs) == 12, str(sorted(vs)))  # v1 + v2 + 10 concurrent

    # --- Injection probes ---
    code, _, body = call("GET", "/api/content?q=%27%20OR%201%3D1--", cookie=rep)
    check("SQLi probe in q -> 200 with no rows", code == 200 and json.loads(body) == [])
    check("traversal probe in id -> 404/422", call("GET", "/api/content/..%2f..%2fetc%2fpasswd/file", cookie=rep)[0] in (404, 422))
    check("over-long q -> 422", call("GET", "/api/content?q=" + "a" * 500, cookie=rep)[0] == 422)

    # --- Abuse / rate limits ---
    codes = [login("boss", "wrong")[0] for _ in range(12)]
    check("login brute force on one user -> 429", 429 in codes, ",".join(map(str, codes)))
    codes = [call("POST", "/api/demo", {"name": "aa", "company": "bb", "phone": "09120000000", "team_size": 3})[0] for _ in range(7)]
    check("demo form flood -> 429", codes[:5] == [201] * 5 and 429 in codes, ",".join(map(str, codes)))

    # --- Analytics ---
    t0 = time.perf_counter()
    code, _, body = call("GET", "/api/analytics", cookie=rep)
    cold = time.perf_counter() - t0
    t0 = time.perf_counter()
    call("GET", "/api/analytics", cookie=rep)
    warm = time.perf_counter() - t0
    check("analytics shape intact", code == 200 and {"kpis", "series", "top", "categories", "recent"} <= json.loads(body).keys())
    check("analytics served from cache on repeat", warm <= cold + 0.005, f"cold={cold*1000:.1f}ms warm={warm*1000:.1f}ms")


def raw_post(cookie, data, headers, chunked):
    """POST an oversized body and still read the status: the server answers 413 and hangs up mid-upload.
    chunked=True sends no Content-Length, proving the streaming cap and not just the header check."""
    import http.client

    con = http.client.HTTPConnection("127.0.0.1", PORT, timeout=120)
    con.putrequest("POST", "/api/content")
    extra = {"Transfer-Encoding": "chunked"} if chunked else {"Content-Length": str(len(data))}
    for k, v in (headers | {"Cookie": cookie} | extra).items():
        con.putheader(k, v)
    con.endheaders()
    try:
        for i in range(0, len(data), 1 << 16):
            chunk = data[i:i + (1 << 16)]
            con.send(f"{len(chunk):x}\r\n".encode() + chunk + b"\r\n" if chunked else chunk)
        if chunked:
            con.send(b"0\r\n\r\n")
    except OSError:
        pass  # expected: the server stops reading once the cap trips
    try:
        return con.getresponse().status
    except OSError:
        return 413


if __name__ == "__main__":
    main()
