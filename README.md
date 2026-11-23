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
  - `GET /admin/lists` → per list: settings, `confirmed`/`pending`/`unsubscribed` counts, `created_at`, `stale_pending` (pending for more than 48h)
  - `GET /admin/export?list_key=` → CSV (`email,status,metadata,confirmed_at,created_at`, RFC-4180 quoted)
  - `GET /admin/contacts?list_key=&status=&q=&pending_older_than=&limit=&offset=` → `{total, contacts}`, newest first. `list_key` is optional (omit to search every list). `pending_older_than=N` (hours, int > 0, else 400) keeps only `pending` contacts created more than N hours ago. Rows: `email, status, position, metadata, confirmed_at, created_at, list_key, list_name, unsubscribed_at` (null until the contact unsubscribes; older unsubscribes have no time)
  - `POST /admin/contacts/confirm` `{list_key, email}` — mark confirmed without sending mail (stuck pending)
  - `POST /admin/contacts/resend` `{list_key, email}` — fresh token + re-send confirm email
  - `DELETE /admin/contacts?list_key=&email=` — remove a contact and its tokens
  - `POST /admin/contacts/bulk` `{action: confirm|resend|delete, contacts: [{list_key, email}]}` — 1 to 500 contacts (400 otherwise), same semantics as the single endpoints; emails are trimmed and lower-cased. `confirm` and `resend` report already-confirmed contacts as failed without changing their history. → `200 {ok: <n succeeded>, failed: [{list_key, email, error}]}`
  - `GET /admin/stats?days=7|14|30|90` → `{lists, confirmed, pending, unsubscribed, stale_pending, by_day, days, series, period, prev_period, list_series}`. `days` defaults to 14; other values clamp to the nearest allowed one. `series` is one zero-filled `{day, confirmed, pending, unsubscribed}` entry per UTC day (oldest first, today included): each signup lands on its `created_at` day, split by current status. `period` / `prev_period` are `{signups, confirmed, unsubscribed}` for the last N days and the N days before (by current status). `list_series` maps each `list_key` (every list) to an array aligned with `series` of that day's signups that are now confirmed. `by_day` is unchanged (confirmed, last 14 days)
  - `GET /admin/activity?limit=50&list_key=&cursor=` → `{events: [{type: signup|confirmed|unsubscribed, email, list_key, list_name, at}], next_cursor}`, newest first, derived from `created_at` / `confirmed_at` / `unsubscribed_at`. `limit` 1-200 and `list_key` optional. Pass the returned `next_cursor` as `cursor` for the next page; it includes tie-breakers and handles mixed stored timestamp formats. Legacy `before=` remains an exclusive timestamp-only filter.

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
