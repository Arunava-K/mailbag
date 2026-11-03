# AGENTS.md

Two-app monorepo, no workspace tooling — each app builds independently:

- `apps/api/` — Go 1.23, stdlib `net/http` only (no framework). Single binary, CGO-free (`modernc.org/sqlite`). Entry: `main.go`; logic in `internal/{config,db,handlers,mailer}`.
- `apps/dashboard/` — React 19 + Vite + Tailwind v4, npm. Path alias `@` → `src`. `components/ui/*` and `components/watermelon/*` are stock shadcn/template components — don't hand-edit for feature work.

API endpoints, request/response shapes, and admin auth are documented in `README.md` — read it before changing handlers.

## Commands

```bash
# Full local stack (api :8080, dashboard :3000) — builds from source
cp .env.example .env    # set BASE_URL=http://localhost:8080, ADMIN_API_KEY=test
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Dashboard hot reload (:5173, /api and /v1 proxied to :8080) — needs the api running above
cd apps/dashboard && npm install && npm run dev

# Verify api (from apps/api)
go build ./... && go vet ./... && go test ./...

# Verify dashboard (from apps/dashboard)
npm run typecheck      # tsc --noEmit
npm run build          # tsc && vite build
```

There is no lint setup in either app. CI (`.github/workflows/ci.yml`) runs `go vet` + `go test` and dashboard typecheck + build on every PR and push to main — keep it green. Go tests live in `internal/handlers/handlers_test.go` (in-memory SQLite via `db.EnsureSchema`, mailer in skip mode); add handler tests there.

## Deploy model — do not break this

- Pushing to `main` **is the deploy**: `.github/workflows/docker.yml` builds both images and pushes to GHCR (`latest` + short-sha). The VPS (Dokploy) only ever pulls `ghcr.io/arunava-k/mailbag-{api,dashboard}:${TAG:-latest}` via `docker-compose.yml` — it never builds. Don't turn `docker-compose.yml` into a build-from-source file.
- GHCR image paths are lowercase even though the GitHub owner is `Arunava-K`. Don't "fix" the casing.
- The workflow is path-filtered (`apps/api/**`, `apps/dashboard/**`, `docker-compose.yml`, the workflow itself) — README-only changes don't deploy.

## Non-obvious behavior

- `VITE_MAILBAG_URL` is baked into the dashboard JS **at Docker build time** (prod URL is hardcoded in the workflow as `PROD_API_URL`; defaults to `/api` locally). Changing the prod API URL means changing the workflow, not just compose.
- DB mode switch: if `TURSO_DATABASE_URL` is set, Turso is used and the `/data` SQLite volume is ignored; otherwise local SQLite in `DATA_DIR`. Schema is in `internal/db/db.go`.
- If `SMTP_HOST` is empty, mail sends are logged and skipped, but the double opt-in flow still works (confirm token lands in the DB). Per-list `provider: smtp|plunk` selects the sender.
- `BASE_URL` must be correct in env — confirm/unsubscribe links are built from it.
- Rate limiting trusts `X-Forwarded-For` (deployed behind Traefik/Dokploy); `website` is a honeypot field on `/v1/subscribe`, not real data.
- Broadcasts are intentionally out of scope for V1 (collection + double opt-in + welcome mail only).
