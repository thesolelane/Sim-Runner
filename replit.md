# Workspace

## Overview

Cooperanth is an onboarding simulation platform: scan any web app URL, auto-detect signup flows, and run automated Playwright simulations to verify they work.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only; use `push-force` to skip prompts)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- Required env vars: `DATABASE_URL`, `PORT`. Optional: `SMTP_URL`, `ALERT_FROM_EMAIL` (for email alerts).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24 | **Package manager**: pnpm | **TypeScript**: 5.9
- **API framework**: Express 5 | **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod` | **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild | **Frontend**: React + Vite + Tailwind + shadcn/ui
- **Test runner**: Playwright (browser automation + simulation engine)

## Where things live

- `lib/db/src/schema/` — DB schema (simulations, simulation-runs)
- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-zod/src/` — generated Zod schemas from OpenAPI
- `lib/api-client-react/src/` — generated React Query hooks from OpenAPI
- `artifacts/api-server/src/` — Express API server
  - `routes/simulations.ts` — all simulation + run endpoints
  - `lib/engine.ts` — Playwright simulation execution engine
  - `lib/scheduling.ts` — node-cron scheduler (registers/runs cron jobs)
  - `lib/alerting.ts` — Slack webhook + email alert dispatcher
- `artifacts/cooperanth-sim-runner/src/` — React frontend
  - `pages/dashboard.tsx` — main dashboard with Monitoring section
  - `pages/simulations/detail.tsx` — simulation detail with Settings tab

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → Zod validators + React Query hooks. Never write client fetch code manually.
- **DB migrations via raw SQL**: `drizzle-kit push` prompts interactively; use `psql $DATABASE_URL` for non-interactive `ALTER TABLE` statements.
- **Cron scheduler in-process**: `node-cron` tasks run in the Express process. On startup, `initializeSchedules()` re-registers all simulations with a non-null `schedule` column.
- **Alert debouncing**: Alerts are suppressed if one was sent within the last hour (checks `last_alerted_at`). Destination is auto-detected as Slack URL vs email.
- **Webhook token as auth**: Each simulation gets a UUID `webhookToken` on creation. `POST /api/simulations/webhook/:token` is public — token in the URL acts as the secret.

## Product

- Scan a URL → AI-detected onboarding steps → create simulation
- Run simulations manually (with optional video recording) or via schedule/webhook
- Scheduling: hourly/daily/weekly presets or custom cron expression per simulation
- Alerts: Slack or email when pass rate drops below threshold (debounced 1/hr)
- Webhook: unique URL per simulation for CI/CD pipeline triggers (GitHub Actions, Coolify, etc.)
- Dashboard Monitoring section: scheduled sims with health status, last alert, threshold

## Gotchas

- `drizzle-kit push` is interactive — use `psql $DATABASE_URL -c "ALTER TABLE..."` for CI or scripted migrations
- Existing simulations created before the monitoring columns were added won't have `webhookToken` — must be set via SQL: `UPDATE simulations SET webhook_token = gen_random_uuid()::text WHERE webhook_token IS NULL`
- `headed_mode` and `video_path` columns on `simulation_runs` must exist in the DB (added via raw SQL if drizzle push wasn't run)
- `Select` component (shadcn/ui) does not accept empty string values — use a sentinel like `"none"` for disabled/unset states
