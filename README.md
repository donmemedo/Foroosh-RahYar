# Tavanfroosh · توان‌فروش

A sales-enablement web app for Iran, based on the Showpad business plan in this folder. It has a content library with versions, an approval workflow, analytics, pricing and an ROI calculator. It supports fa/en, light/dark and every screen size.

The marketing page is public. The library and dashboard need a login. Reps can upload, add versions and share approved items. Admins can also approve, delete and turn off share links. Customers receive a revocable `/s/<token>` link that shows only the shared item. Security details are in [SECURITY_REPORT.md](SECURITY_REPORT.md).

## Run with Docker

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_hex(32))"   # paste as SECRET_KEY
cd backend && python3 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt
.venv/bin/python main.py hash-password                       # paste as AUTH_USERS="you:admin:<hash>"
cd .. && docker compose up --build
```

- Web: http://localhost:3011 (the API is reached only through the web tier at `/api`)
- SQLite and uploads live in the `data` volume.
- Upgrading an existing deployment: the API now runs as uid 10001. Fix the old root-owned volume once with `docker compose run --rm -u 0 backend chown -R 10001 /data`. `/api/health` returns 503 until it is writable.

## Run locally

```bash
# backend (API docs at /docs only with ENABLE_DOCS=1)
cd backend && python3 -m venv .venv && .venv/bin/pip install --require-hashes -r requirements.txt
AUTH_USERS="you:admin:<hash>" SECRET_KEY=<hex> SEED_DEMO=1 .venv/bin/python -m uvicorn main:app --port 8011

# frontend (BACKEND_URL is baked in at build time)
cd frontend && npm ci
BACKEND_URL=http://localhost:8011 npm run dev -- -p 3011
```

## Security check

```bash
cd backend && .venv/bin/python test_security.py   # boots the API on a temp DB and runs the pen-test battery
```

Dependencies are pinned. To update the backend lock: `uv pip compile requirements.in --python-version 3.12 --generate-hashes -o requirements.txt`. For the frontend, run `npm audit`.
