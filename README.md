# Mailbag — headless email collection (monorepo)

[![docker](https://github.com/Arunava-K/mailbag/actions/workflows/docker.yml/badge.svg)](https://github.com/Arunava-K/mailbag/actions/workflows/docker.yml)

```
apps/api/        Go collector API (Dokploy on VPS, Turso or SQLite)
apps/dashboard/  React + Vite control panel (nginx, same compose)
```

Single Go binary. Native forms on your sites POST to it. DB: Turso (set `TURSO_*`) or local SQLite fallback.

## API

- `POST /v1/subscribe` `{list_key, email, metadata?, website?}` → `{status: pending|confirmed, position?}`
- `GET /v1/confirm?token=` → confirms + sends welcome mail (or redirects to `confirm_redirect`)
- `POST /v1/unsubscribe` `{list_key, email}` + `GET /v1/unsubscribe?list_key=&email=` (email links)
- Admin (header `Authorization: Bearer $ADMIN_API_KEY`):
  - `POST /admin/lists` `{name, type: newsletter|waitlist, sender_name, sender_email, provider: smtp|plunk, welcome_subject, welcome_body, confirm_redirect}` → `{list_key}`
  - `GET /admin/lists` → counts per list
  - `GET /admin/export?list_key=` → CSV

CORS is open (`*`) on `/v1/*` so any static site can `fetch()` it directly. Spam defense: IP rate limit (20/min, `X-Forwarded-For` aware behind Traefik), honeypot `website` field, email validation.

## Frontend usage

See `apps/api/examples/native-form.html`. Keep your own CSS, just POST JSON with your `list_key` (`pk_...`).

## Dokploy deploy (same VPS)

Images are built by GitHub Actions (`.github/workflows/docker.yml`) on every push to `main` and pushed to GHCR — the VPS only pulls, never builds:

- `ghcr.io/arunava-k/mailbag-api:latest` (+ short-sha tags)
- `ghcr.io/arunava-k/mailbag-dashboard:latest` (+ short-sha tags, API URL baked in)

1. Push to `main` (or trigger the workflow manually once). If the GHCR packages are private, either flip them to public (package settings — images contain no secrets) or add registry credentials in Dokploy.
2. Dokploy → New App → Docker Compose, point at repo. It uses `docker-compose.yml` as-is.
3. Volumes: `mailbag-data:/data` covers local-SQLite mode. Unused when `TURSO_DATABASE_URL` is set.
4. Domains: `mailbag-api.steinerandco.space` → service `mailbag` : 8080, `mailbag.steinerandco.space` → service `dashboard` : 80. TLS on.
5. Env (copy from `.env.example`):
   - `BASE_URL=https://mailbag-api.steinerandco.space` (confirm links break without this)
   - `ADMIN_API_KEY=<long random>`
   - `TURSO_DATABASE_URL=libsql://xxx.turso.io` + `TURSO_AUTH_TOKEN=...` (recommended)
   - `SMTP_HOST/PORT/USER/PASS/FROM` and/or `PLUNK_API_KEY` (required — without a sender, confirms are logged + skipped)
   - Optional: `TAG=<short-sha>` to pin both services to one build instead of `latest`.
6. Deploy. Test: `curl https://mailbag-api.steinerandco.space/health` → `{"status":"ok"}`.
7. Create first list:
   ```bash
   curl -X POST https://mailbag-api.steinerandco.space/admin/lists \
     -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
     -d '{"name":"My Newsletter","type":"newsletter","sender_name":"Me","sender_email":"hello@yourdomain.com","provider":"smtp"}'
   ```
   → `{"list_key":"pk_..."}` — paste into your Pages forms.

Footprint (measured): API ~21 MB image / ~3 MB RAM idle; dashboard ~93 MB image (nginx) / ~5 MB RAM; ~0.5 KB SQLite per pending subscriber. Safe to co-host on your existing VPS.

## Local dev

```bash
cp .env.example .env   # set BASE_URL=http://localhost:8080, ADMIN_API_KEY=test
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
curl localhost:8080/health   # api
curl localhost:3000/          # dashboard (VITE_MAILBAG_URL=/api default)

# dashboard hot-reload instead (needs the api above on :8080)
cd apps/dashboard && npm install && npm run dev  # -> :5173, /api proxied
```

## Notes

- Dev mode: if `SMTP_HOST` is empty, sends are logged + skipped (full flow still testable via token in DB).
- Per-list `provider: smtp|plunk` lets newsletters use SMTP and SaaS lists use Plunk.
- Broadcasts intentionally out of scope for V1 — collection + double opt-in + welcome only.
