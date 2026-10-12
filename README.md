# MailCollector V1 — headless email collection

Single Go binary. Native forms on your sites POST to it. DB: Turso (set `TURSO_*`) or local SQLite fallback.

## API

- `POST /v1/subscribe` `{list_key, email, metadata?, website?}` → `{status: pending|confirmed, position?}`
- `GET /v1/confirm?token=` → confirms + sends welcome mail (or redirects to `confirm_redirect`)
- `POST /v1/unsubscribe` `{list_key, email}` + `GET /v1/unsubscribe?list_key=&email=` (email links)
- Admin (header `Authorization: Bearer $ADMIN_API_KEY`):
  - `POST /admin/lists` `{name, type: newsletter|waitlist, sender_name, sender_email, provider: smtp|plunk, welcome_subject, welcome_body, confirm_redirect}` → `{list_key}`
  - `GET /admin/lists` → counts per list
  - `GET /admin/export?list_key=` → CSV

CORS is open (`*`) on `/v1/*` so any Cloudflare Pages static site can `fetch()` it directly. Spam defense: IP rate limit (20/min), honeypot `website` field, email validation.

## Frontend usage (Cloudflare Pages)

See `examples/native-form.html`. Keep your own CSS, just POST JSON with your `list_key` (`pk_...`).

## Dokploy deploy (same VPS)

1. Push this folder to a git repo.
2. Dokploy → New App → Docker Compose, point at repo. It uses `docker-compose.yml` as-is.
3. Volumes: `collector-data:/data` covers local-SQLite mode. Unused when `TURSO_DATABASE_URL` is set.
4. Domains: add `collect.yourdomain.com` in Dokploy, TLS on.
5. Env (copy from `.env.example`):
   - `BASE_URL=https://collect.yourdomain.com` (confirm links break without this)
   - `ADMIN_API_KEY=<long random>`
   - `TURSO_DATABASE_URL=libsql://xxx.turso.io` + `TURSO_AUTH_TOKEN=...` (recommended)
   - `SMTP_HOST/PORT/USER/PASS/FROM` and/or `PLUNK_API_KEY`
6. Deploy. Test: `curl https://collect.yourdomain.com/health` → `{"status":"ok"}`.
7. Create first list:
   ```bash
   curl -X POST https://collect.yourdomain.com/admin/lists \
     -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
     -d '{"name":"My Newsletter","type":"newsletter","sender_name":"Me","sender_email":"hello@yourdomain.com","provider":"smtp"}'
   ```
   → `{"list_key":"pk_..."}` — paste into your Pages forms.

Footprint: ~15 MB image, ~20–30 MB RAM idle. Safe to co-host on your existing VPS.

## Local dev

```bash
cp .env.example .env   # set BASE_URL=http://localhost:8080, ADMIN_API_KEY=test
docker compose up --build
curl localhost:8080/health
```

## Notes

- Dev mode: if `SMTP_HOST` is empty, sends are logged + skipped (full flow still testable via token in DB).
- Per-list `provider: smtp|plunk` lets newsletters use SMTP and SaaS lists use Plunk.
- Broadcasts intentionally out of scope for V1 — collection + double opt-in + welcome only.
