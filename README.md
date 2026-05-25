# Cooperanth

An onboarding simulation platform that drives real signup flows in any web app via headless Playwright browsers — no admin-API shortcuts, no mocks. Scan a URL, auto-detect the onboarding steps, then run synthetic users through the real UI on a schedule to verify it still works.

Originally built to validate the contractor signup flow on [dev.traydbook.com](https://dev.traydbook.com), but generalizes to any web app.

## What it does

- **Scan** any signup URL → AI-detected step list (form fields, buttons, selects, waits).
- **Run** simulations manually, on a schedule (cron), or via a per-simulation webhook URL.
- **Generate** unique synthetic users per run (email aliases, seed-based passwords, state/country/trade values).
- **Record** every step with screenshots, network logs, and optional video.
- **Alert** on Slack or email when pass rate drops below a configurable threshold (debounced 1/hr).
- **Monitor** all scheduled simulations from a dashboard with health status and last-alert time.

## Stack

- **Monorepo:** pnpm workspaces, TypeScript 5.9, Node 24
- **API:** Express 5 + Drizzle ORM on PostgreSQL
- **Contract:** OpenAPI → Orval-generated Zod validators + React Query hooks (never write client fetch code by hand)
- **Frontend:** React + Vite + Tailwind + shadcn/ui
- **Engine:** Playwright (Chromium) for browser automation
- **Scheduler:** `node-cron` in-process

## Repo layout

```
artifacts/
  api-server/             Express API + Playwright engine + cron scheduler + alerting
  cooperanth-sim-runner/  React dashboard (sim list, detail, run history, monitoring)
  mockup-sandbox/         Vite preview server for component prototyping
lib/
  db/                     Drizzle schema (simulations, simulation_runs)
  api-spec/               OpenAPI source of truth
  api-zod/                Generated Zod validators
  api-client-react/       Generated React Query hooks
```

## Common commands

```bash
pnpm run typecheck                                    # full typecheck across all packages
pnpm run build                                        # typecheck + build everything
pnpm --filter @workspace/api-spec   run codegen       # regenerate Zod + React hooks from OpenAPI
pnpm --filter @workspace/db         run push          # push DB schema changes (dev only)
pnpm --filter @workspace/api-server run dev           # run API + engine locally
pnpm --filter @workspace/cooperanth-sim-runner run dev  # run the dashboard locally
```

## Required environment

- `DATABASE_URL` — Postgres connection string
- `PORT` — assigned per-artifact by the workflow

Optional:

- `SMTP_URL`, `ALERT_FROM_EMAIL` — for email alerts
- `SIM_EMAIL_BASE` — override the default `+sim<seed>@gmail.com` alias base
- `SIM_WEBHOOK_SECRET` — shared secret for webhook auth (also per-simulation UUID tokens)

## Architecture notes

- **Contract-first API.** OpenAPI spec drives Zod validators and React Query hooks via Orval. Server validates inputs and outputs with the generated Zod schemas; clients use the generated hooks.
- **Cron scheduler in-process.** On API server startup, `initializeSchedules()` re-registers every simulation with a non-null `schedule` column.
- **Alert debouncing.** Suppressed if one was sent within the last hour (`last_alerted_at`). Destination is auto-detected as Slack URL vs email.
- **Webhook token as auth.** Each simulation gets a UUID `webhookToken` on creation. `POST /api/simulations/webhook/:token` is public — the token in the URL is the secret.
- **Real UI, no shortcuts.** The engine drives the actual signup flow with a real browser. No admin-API account creation, no Supabase admin SDK — same code path a real user takes.

## License

Private — not open source.
