# Cooperanth Sim Runner - SaaS Architecture

## Multi-Tenant Design

```
cooperanth-saas/
├── backend/
│   ├── server.js           # Express API
│   ├── auth.js             # User auth (Clerk/Auth0)
│   ├── apps.controller.js  # CRUD for apps
│   ├── runs.controller.js  # CRUD for simulation runs
│   └── db.js               # PostgreSQL connection
├── frontend/
│   ├── dashboard/          # React app
│   ├── app-builder/        # Drag-drop flow builder
│   └── results/            # Charts, reports, screenshots
├── runner/
│   ├── docker/             # Playwright + k6 containers
│   ├── queue.js            # Bull/Redis job queue
│   └── worker.js           # Processes simulation jobs
└── integrations/
    ├── github.js           # GitHub App integration
    ├── slack.js            # Slack notifications
    └── stripe.js           # Billing
```

## Database Schema

```sql
-- Users (tenants)
users (id, email, plan, stripe_customer_id, created_at)

-- Apps (per user)
apps (id, user_id, name, url, type, config_json, created_at)

-- Simulations (per app)
simulations (id, app_id, name, user_type, flow_json, schedule, active)

-- Runs (per simulation)
runs (id, simulation_id, status, passed, failed, duration_ms, screenshot_urls, created_at)

-- Results (per step)
results (id, run_id, step_name, success, detail, duration_ms, created_at)
```

## Pricing Tiers

| Plan | Apps | Runs/Month | Features | Price |
|------|------|-----------|----------|-------|
| Free | 1 | 100 | Basic flows, email alerts | $0 |
| Starter | 3 | Unlimited | All user types, Slack, scheduled | $29/mo |
| Pro | 10 | Unlimited | Team access, API, competitor audit | $99/mo |
| Enterprise | Unlimited | Unlimited | Custom integrations, dedicated runner, SLA | $499/mo |

## API Endpoints

```
POST /api/v1/apps              # Create app
GET  /api/v1/apps/:id/runs     # Get run history
POST /api/v1/runs              # Trigger simulation
GET  /api/v1/runs/:id/results  # Get detailed results
POST /api/v1/webhooks/github   # GitHub integration
```

## Deployment Options

1. **Cloud (cooperanth.io)** - We host, you pay monthly
2. **Self-hosted** - You host, one-time license fee
3. **White-label** - Embed in your own dashboard
