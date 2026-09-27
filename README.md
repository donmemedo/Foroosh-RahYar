# Tavanfroosh · توان‌فروش

A sales-enablement web app for Iran, based on the Showpad business plan in this folder. It has a content library with versions, an approval workflow, analytics, pricing and an ROI calculator. It supports fa/en, light/dark and every screen size.

## Run with Docker

```bash
docker compose up --build
```

- Web: http://localhost:3011
- API: http://localhost:8011/docs (SQLite and uploads live in the `data` volume)

## Run locally

```bash
# backend
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --port 8011

# frontend (BACKEND_URL is baked in at build time)
cd frontend && npm install
BACKEND_URL=http://localhost:8011 npm run dev -- -p 3011
```
