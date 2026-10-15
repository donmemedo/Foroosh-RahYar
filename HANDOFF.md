# Tavanfroosh (توان‌فروش) — Session Handoff

**Purpose:** continue the security hardening + performance + UI/UX work on this repo with any model.
**Date:** 2026-10-02
**Scope of the request:** red-team/blue-team audit, local pen test, add performance fixes alongside every security fix, UI/UX pass using the `apple-design` skill. Target: finish in one sitting.
**Status:** review complete, findings below. **No repository files have been changed yet** (except this `HANDOFF.md`). Everything below is to-do.

---

## 1. What this app is

Sales-enablement MVP for the Iranian market. Content library with versions, an approval workflow, analytics, pricing, and an ROI calculator. Bilingual (fa/en), light/dark, responsive.

| Part | Stack | Entry points |
|---|---|---|
| Backend | FastAPI 0.115 + stdlib `sqlite3`, single file | `backend/main.py` (241 lines) |
| Frontend | Next.js 16.3.6, React 19, Tailwind 4 | `frontend/app/{page,dashboard/page,library/page,layout}.tsx`, `frontend/components/{Shell,ui,Charts}.tsx`, `frontend/lib/{api.ts,i18n.tsx}`, `frontend/app/globals.css` |
| Infra | Docker Compose, 2 Dockerfiles | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/next.config.ts` |

Data model (sqlite): `content`, `versions`, `events` (view/share), `demo_requests` (name, company, phone, team_size). DB + uploads live in a `data` volume. The frontend proxies `/api/*` to the backend via `next.config.ts` rewrites.

---

## 2. Current running state (this machine)

Both dev servers were started during the session against a **scratch copy** of the DB (so the pen test did not touch `backend/data/app.db`):

- **API** — uvicorn, `http://localhost:8011`, PID **155757**, `DATA_DIR=/tmp/claude-1000/-home-makhataei-Projects-Mine-Foroosh-RahYar/4727c57a-0842-4a41-8868-ee08e0bc5172/scratchpad/pentest-data`. Health returns `200`.
- **Web** — Next dev (Turbopack), `http://localhost:3011`, PID **155084/155086**. Proxy `/api/*` → `:8011` works.

Logs: `…/scratchpad/api.log`, `…/scratchpad/web.log`. To stop them: `kill 155757 155084`.

> The automated audit workflow was **not** run — two attempts were interrupted before producing output. The findings below come from a full manual read of every source file plus the dependency/version checks listed, not from the workflow. A continuing model can either act on them directly or re-run an audit to expand coverage.

**Installed backend deps (verified, patched):** fastapi 0.115.14, starlette 0.46.2, uvicorn 0.32.1, python-multipart 0.0.32, pydantic 2.13.5. No known-vulnerable versions are installed right now. The supply-chain risk is the *floating pins* (§4 SC-1), not the current install.

---

## 3. How to resume

```bash
# Backend (uses backend/data/ by default; for testing, point DATA_DIR at a scratch dir)
cd backend && .venv/bin/uvicorn main:app --port 8011
# Frontend
cd frontend && BACKEND_URL=http://localhost:8011 npm run dev -- -p 3011
# Full stack
docker compose up --build    # web :3011, api :8011
```

After backend code edits, re-run graphify per project rules: `graphify update .`

---

## 4. Security findings (prioritized, blue-team remediation)

Severity reflects this being a public-facing MVP. Each item is phrased as *what to change*. File refs are to the current tree.

### Critical / High — no access control

- **SEC-1 (Critical): every write endpoint is unauthenticated.** `backend/main.py` exposes create/approve/delete/new-version/event-tracking with no auth. Anyone who can reach the API can approve their own "pending" content (bypassing the whole marketing-approval premise at `/api/content/{cid}/approve`, line 154), delete any item (line 181), or inflate analytics by POSTing to `/api/content/{cid}/events/{kind}` (line 162).
  **Fix:** introduce an auth layer. Minimum viable: a bearer token / session for all mutating routes and for `/analytics`; split public read (approved content only) from authenticated write. A FastAPI dependency (`Depends(require_user)`) on every non-public route is the smallest change. Add a `role` check so only approvers can call `/approve`.
  **Perf tie-in:** gate `/analytics` behind auth *and* cache it (see PERF-2) — it is the most expensive endpoint and currently anonymous, so it doubles as a cheap DoS vector.

- **SEC-2 (High): public file download / IDOR.** `GET /api/content/{cid}/file` (line 172) serves uploaded sales material to anyone holding the 10-hex id. Ids are only ~40 bits and are *handed out* in share links (`?c=<id>` in `library/page.tsx`), so "unguessable" is not a control.
  **Fix:** require auth for downloads (or signed, expiring URLs). At minimum rate-limit this route to blunt id brute force.

### High — upload surface

- **SEC-3 (High): uploaded files have no type validation and may be served inline → stored XSS.** `create_content` (lines 122-138) accepts any file; the stored name is server-generated (`cid + suffix`, so **no path traversal** — good), but there is no content-type/extension allow-list. `download` (line 178) uses `FileResponse`, which sets `Content-Type` from the extension. An uploaded `.html`/`.svg` fetched same-origin through the Next proxy (`/api/content/{id}/file`) can execute script in the app origin.
  **Fix:** allow-list extensions/MIME (pdf, pptx, docx, mp4, images…), sniff magic bytes, and force `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff` on downloads. Consider serving uploads from a separate origin/CDN.

- **SEC-4 (Medium): Content-Disposition built from user input.** `download` passes `filename=item["title_en"] + suffix` (line 178); `title_en` is user-controlled (≤120 chars). Modern Starlette RFC-6266-encodes this, so it is likely safe, but **verify** with a title containing CRLF/quotes/non-ASCII and confirm no header splitting.
  **Fix:** sanitize to a safe filename server-side regardless of Starlette's behavior.

### Medium — DoS / resource handling

- **SEC-5 / PERF-1 (Medium): no rate limiting anywhere.** Demo form (`/api/demo`), event tracking, and uploads can all be flooded by an anonymous client. Combined with SEC-1 this is the main abuse surface.
  **Fix:** add `slowapi` (or a reverse-proxy limit) on `/demo`, `/events/*`, and `POST /content`.

- **SEC-6 (Medium): 50 MB uploads buffered fully in memory.** `await file.read(MAX_UPLOAD + 1)` (line 129) holds the whole blob in RAM; concurrent uploads multiply it. Size *is* capped (good).
  **Fix:** stream to disk in chunks (`shutil.copyfileobj`) with a running size check; also cap concurrent uploads.

- **SEC-7 (Low/Medium): sqlite connections are never explicitly closed.** `db()` (line 25) opens a connection; handlers use `with db() as con` — the sqlite context manager commits/rolls back but **does not close**. In CPython the connection is GC-collected promptly, so this is not a hard fd leak today, but it is non-deterministic and sloppy.
  **Fix:** a FastAPI dependency that yields a connection and closes it in `finally`, or an explicit `con.close()`. This also sets up pooling for PERF-3.

### Config / infra

- **SEC-8 (High): CORS fully open.** `allow_origins="*"`, `allow_methods=["*"]`, `allow_headers=["*"]` (line 22, via env default). Pair that with SEC-1 and any site can drive the API from a victim's browser.
  **Fix:** set `CORS_ORIGINS` to the real web origin(s); since the frontend uses a same-origin proxy, CORS can be **off** in production.

- **SEC-9 (Medium): no security headers** on either tier. No CSP, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, HSTS.
  **Fix:** add them in `next.config.ts` `headers()` for the web and in a backend middleware for API responses. A CSP is the highest-value one here and also limits SEC-3 blast radius.

- **SEC-10 (Medium): backend container runs as root.** `backend/Dockerfile` has no `USER`. Frontend is fine (`USER node`, `npm ci`). The host also publishes `8011` directly, bypassing the proxy and exposing `/docs` + `/openapi.json`.
  **Fix:** add a non-root user to the backend image; don't publish `8011` publicly (only the web tier needs it, over the compose network); disable `/docs` in prod (`FastAPI(docs_url=None, openapi_url=None)` or gate it).

### Frontend / privacy

- **SEC-11 (Medium, Iran-specific): Google Fonts loaded at runtime.** `app/layout.tsx` (lines 31-34) pulls Vazirmatn from `fonts.googleapis.com`. This leaks every visitor's IP/referer to Google, has **no SRI**, and — for an Iran-targeted app — is a real **availability** risk (may be blocked/slow). It is also a render-blocking third-party request (see PERF-4).
  **Fix:** self-host Vazirmatn via `next/font/local` (woff2, subset). Kills the privacy leak, the supply-chain exposure, and the perf hit in one change.

- **SEC-12 (Low): `?c=` not URL-encoded.** `library/page.tsx` interpolates the `c` query param into `/content/${id}` without `encodeURIComponent`. React escapes it on render, so impact is low, but encode it before building the fetch path.

- **SEC-13 (Low): `lang` cookie set client-side without flags.** `lib/i18n.tsx` sets `document.cookie = "lang=…;samesite=lax"` — add `Secure`; it's non-sensitive, so low priority.

- **SEC-14 (Low): `dangerouslySetInnerHTML` in `layout.tsx`** (line 30) — content is a **static** theme script, so it's safe. Noted only so a future edit doesn't make it dynamic.

### Supply chain

- **SC-1 (Medium): non-reproducible backend builds.** `requirements.txt` pins `fastapi==0.115.*`, `uvicorn[standard]==0.32.*`, `python-multipart==0.0.*`. Floating patch ranges mean a rebuild can silently pull a different (possibly regressed) version. *Installed* versions are currently patched (see §2).
  **Fix:** pin exact versions + hashes (`pip-compile`/`uv lock`). Pin Docker base images by digest (`python:3.12-slim@sha256:…`, `node:24-alpine@sha256:…`).
- **SC-2 (info): run `npm audit` / `npm ls` in `frontend/`** — not yet executed this session; do it as a quick confirm.

---

## 5. Performance findings (pair each with the security fix above)

- **PERF-1:** rate limiting (SEC-5) also protects latency under abuse.
- **PERF-2 (High value): `/api/analytics` is the hot path and recomputes everything per request.** `analytics()` (lines 192-215) loads all `events` rows into Python and aggregates categories in a Python loop. **Fix:** add a short-TTL cache (30-60 s) — the data is demo/append-only and doesn't need per-request freshness. Do the category aggregation in SQL (`GROUP BY`) instead of Python.
- **PERF-3: no DB indexes.** `events` has no index on `content_id`, `type`, or `ts`; `content` none on `updated_at`. The analytics subqueries (`ROW`, lines 82-83) and `WHERE ts>=?` scan full tables. **Fix:** `CREATE INDEX` on `events(content_id, type)`, `events(ts)`, `content(updated_at)`. Biggest win for the money.
- **PERF-4: self-host fonts** (SEC-11) removes a render-blocking third-party request and improves LCP, especially inside Iran.
- **PERF-5: `list_content` returns all rows unbounded** (lines 98-111). Fine at demo scale; add `LIMIT`/pagination before real data volumes.
- **PERF-6 (good, keep):** charts are hand-rolled SVG (`components/Charts.tsx`) — no heavy charting lib. `CountUp` uses `requestAnimationFrame`. Leave as is.

---

## 6. UI/UX notes (apple-design skill, already loaded this session)

The frontend is already strong on the apple-design axes: glass/`backdrop-filter` materials, a circular **View Transition** theme toggle in `Shell.tsx`, RTL support, `prefers-reduced-motion` handling in `globals.css`, tabular-nums, iOS-style bottom tab bar, native `<dialog>` sheets. Gaps to polish against the skill's principles:

1. **Interruptibility (skill §3, the big one):** motion is CSS transitions/`@keyframes`, which can't be grabbed/reversed mid-flight. For the bottom **sheet** (`ui.tsx` `Sheet`) and card hovers, consider a spring lib (Motion) with velocity hand-off so a half-open sheet follows the finger. Highest-effort, highest-"feel" item.
2. **Direct manipulation:** the sheet has no drag-to-dismiss; add pointer tracking + momentum projection (skill §6) so a downward flick closes it.
3. **Respond on pointer-down (skill §1):** buttons animate on `:active` (good); ensure library cards give instant press feedback before the fetch resolves.
4. **Typography tracking (skill §15):** display headings already use tight tracking in places; make tracking size-specific across all heading sizes rather than a single value.
5. **Nav labels (skill §16, "direct labels"):** "Home" / "خانه" is the one vague nav item — consider a more specific name. Minor.

Everything else (depth, materials, reduced-motion, color tokens in `globals.css`) already follows the guidance — don't rebuild it.

Persian copy already matches the user's UX-vocab reference (پیش‌خوان, جستجو, حذف, تایید, در حال بررسی, دریافت). Keep that vocabulary for any new strings.

---

## 7. Suggested order for the continuing model

Do security + its paired perf fix together, cheapest-blast-radius first:

1. **SEC-8 + SEC-10** (CORS, non-root, don't expose `8011`/`/docs`) — config only, no code risk.
2. **SEC-9** security headers + CSP (`next.config.ts` + backend middleware).
3. **SEC-11 / PERF-4** self-host Vazirmatn.
4. **PERF-3 + PERF-2** DB indexes + analytics cache — biggest perf win, low risk.
5. **SEC-1** auth layer on writes + `/analytics` (the core fix; largest change).
6. **SEC-2 + SEC-3 + SEC-4 + SEC-6** download auth + upload allow-list + attachment headers + streamed writes.
7. **SEC-5 / PERF-1** rate limiting.
8. **SEC-7** connection lifecycle; **SC-1** pin deps + digests.
9. **SEC-12 / SEC-13** encode `?c=`, `Secure` cookie.
10. UI/UX §6 polish (springy interruptible sheet last — it's the most involved).

After each backend change: `graphify update .`. Re-test live against a scratch `DATA_DIR` copy, never the real `backend/data/app.db`.

---

## 8. What was NOT done

- No repo files modified (this handoff is the only addition).
- The automated multi-agent audit workflow did not complete — findings here are from manual review; a deeper automated sweep (e.g. `npm audit`, header fuzzing, concurrency testing) is still open.
- No fixes applied, no tests written, no commits made.

---

## 9. Session 2 progress (2026-10-08)

- Branch `security/red-blue-hardening` created. **No source files changed yet.**
- **Baseline pen test done** against the original code on a scratch DB: `handoff/pentest-baseline.txt`. Confirmed live: anon approve 200, anon analytics 200, 50/50 fake share events accepted, `.html` upload accepted and served as `text/html`, CORS `*` for an evil origin, `/docs` + `/openapi.json` 200, `server: uvicorn` banner, zero security headers, stored file name leaked in list, 30/30 demo-form flood accepted, anon delete works.
- **Independent audit workflow done** (5 auditors + 5 adversarial verifiers, baseline commit): `handoff/audit-workflow-findings.json`, with `confirmed` and `rejected` lists. New confirmed items include: approval gate not enforced on share/download; share links expose the whole internal library with a non-revocable id (use scoped share tokens); cross-site "simple" POSTs work, so block writes by `Sec-Fetch-Site` and allow-list Host. Read the full file before fixing.
- **Verified facts for the fix design:**
  - Venv has no `uvicorn` launcher. Use `.venv/bin/python -m uvicorn`.
  - Uvicorn 0.32 trusts proxy headers from `FORWARDED_ALLOW_IPS` (CIDR supported).
  - Next 16 sets `x-forwarded-for` only if the client didn't send one, and rewrites don't append, so the client IP is spoofable. Key rate limits on session user and login username, with per-IP limits as secondary only.
  - Next 16 CSP: use `proxy.ts` with a per-request nonce. Exclude `/api` from the matcher, because proxy buffers bodies at 10 MB by default and that would break 50 MB uploads. Use `style-src 'self' 'unsafe-inline'`, because inline `style` attributes can't take a nonce.
  - `frontend/Dockerfile` copies `/app/public`, which doesn't exist, so the image build fails. Delete that line.
  - `npm audit`: sharp <0.35.5 and source-map-js <1.2.2 (both high, transitive). `npm audit fix` resolves both.
- **Remaining (at end of session 2):** every fix in §7 plus the new audit items, apple-design UI pass, after-fix pen test, `graphify` build, report, commit, push, PR.

## 10. Session 3 result (2026-10-15)

Everything in §7 and the confirmed audit items is implemented on `security/red-blue-hardening`. **Read `SECURITY_REPORT.md` first.** It is the source of truth now; §4-§8 above describe the pre-fix state.

- Pen test after the fixes: `handoff/pentest-after.txt`, 51/51. Re-run with `cd backend && .venv/bin/python test_security.py`.
- `npm audit`: 0. Next is pinned to 16.3.8. The backend lock is hash-pinned (FastAPI 0.141.1, Starlette 1.7.0).
- `next build` passes. The end-to-end run through the standalone server passed except the share-page render, which couldn't finish because the machine ran out of memory (see report §5).
- Open decisions for the owner: report §8.

