# Mailbag — headless email collection (monorepo)

[![docker](https://github.com/Arunava-K/mailbag/actions/workflows/docker.yml/badge.svg)](https://github.com/Arunava-K/mailbag/actions/workflows/docker.yml)

```
apps/api/        Go collector API (Dokploy on VPS, Turso or SQLite)
apps/dashboard/  React + Vite control panel (nginx, same compose)
```

Single Go binary. Native forms on your sites POST to it. DB: Turso (set `TURSO_*`) or local SQLite fallback.

## API

- `GET /health` → `{status: "ok", version, commit}` — liveness + which build answers
- `GET /version` → `{version, commit, build_time, go}` — public build identity, no key needed
- `POST /v1/subscribe` `{list_key, email, metadata?, website?}` → `{status: pending|confirmed, position?}`
- `GET /v1/confirm?token=` → confirms + sends welcome mail (or redirects to `confirm_redirect`)
- `POST /v1/unsubscribe` `{list_key, email}` + `GET /v1/unsubscribe?list_key=&email=` (email links)
- Admin (header `Authorization: Bearer $ADMIN_API_KEY`):
  - `POST /admin/lists` `{name, type: newsletter|waitlist, sender_name, sender_email, provider: smtp|plunk, welcome_subject, welcome_body, confirm_redirect}` → `{list_key}`
  - `GET /admin/lists` → counts per list
  - `GET /admin/export?list_key=` → CSV (`email,status,metadata,confirmed_at,created_at`, RFC-4180 quoted)
  - `GET /admin/contacts?list_key=&status=&q=&limit=&offset=` → paged contacts
  - `POST /admin/contacts/confirm` `{list_key, email}` — mark confirmed without sending mail (stuck pending)
  - `POST /admin/contacts/resend` `{list_key, email}` — fresh token + re-send confirm email
  - `DELETE /admin/contacts?list_key=&email=` — remove a contact and its tokens

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
6. Deploy. Test: `curl https://mailbag-api.steinerandco.space/version` → the version, git SHA, and build time that is now live; `curl https://mailbag.steinerandco.space/version.json` → the dashboard's.
7. Create first list:
   ```bash
   curl -X POST https://mailbag-api.steinerandco.space/admin/lists \
     -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
     -d '{"name":"My Newsletter","type":"newsletter","sender_name":"Me","sender_email":"hello@yourdomain.com","provider":"smtp"}'
   ```
   → `{"list_key":"pk_..."}` — paste into your Pages forms.

## Versioning & deploy verification

`VERSION` at the repo root is the one human-readable version for both apps. Bump it in the PR that ships the change — the docker workflow reads it, adds the git SHA and a UTC build timestamp, and bakes all three into both images:

- **API**: linked in via `-ldflags -X mailbag/internal/version.*`, served by `GET /version`, echoed in `/health`, logged at startup as `mailbag 0.1.0 (7d53563, built 2026-11-03T06:39:09Z)`.
- **Dashboard**: `VITE_APP_*` baked into the JS by Vite, plus a `version.json` next to `index.html` for curl. Shown in the sidebar footer (`v0.1.0 · 7d53563`) and in Settings → Builds.

A deploy can be checked end to end without a browser:

```bash
curl -s https://mailbag-api.steinerandco.space/version
curl -s https://mailbag.steinerandco.space/version.json
```

The dashboard compares its own SHA with the API's on load: same commit → green "API online"; a mismatch turns the dot amber and reads "out of sync", which means only one of the two containers picked up the new image.

Footprint (measured): API ~21 MB image / ~3 MB RAM idle; dashboard ~93 MB image (nginx) / ~5 MB RAM; ~0.5 KB SQLite per pending subscriber. Safe to co-host on your existing VPS.

## Local dev

```bash
cp .env.example .env   # set BASE_URL=http://localhost:8080, ADMIN_API_KEY=test
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
curl localhost:8080/health   # api
curl localhost:8080/version  # api build identity
curl localhost:3000/          # dashboard (VITE_MAILBAG_URL=/api default)

# dashboard hot-reload instead (needs the api above on :8080)
cd apps/dashboard && npm install && npm run dev  # -> :5173, /api proxied
```

## Notes

- Dev mode: if `SMTP_HOST` is empty, sends are logged + skipped (full flow still testable via token in DB).
- `SMTP_PORT=465` uses implicit TLS (port 465 doesn't speak STARTTLS); 587 and others use `net/smtp` STARTTLS as before.
- Admin auth: constant-time key compare; an IP with 10 failed keys in 15 minutes is locked out of `/admin/*` (correct key included) until the window slides past.
- Rate limiting derives the client IP as: `CF-Connecting-IP` (Cloudflare overwrites it) → rightmost `X-Forwarded-For` entry (Traefik appends the real peer) → socket address. A client that bypasses Cloudflare straight to Traefik can still forge `CF-Connecting-IP`; setting Traefik's `forwardedHeaders.trustedIPs` to Cloudflare's ranges closes that.
- Per-list `provider: smtp|plunk` lets newsletters use SMTP and SaaS lists use Plunk.
- Broadcasts intentionally out of scope for V1 — collection + double opt-in + welcome only.
