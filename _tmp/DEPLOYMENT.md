# TraydBook — Deployment Guide

This project has two deployable apps built from one repository:

| App | Dockerfile | Port | Domain |
|---|---|---|---|
| Main platform | `Dockerfile` | 3001 | `app.traydbook.com` |
| Admin panel | `Dockerfile.admin` | 4000 | `admin.traydbook.com` |

Both are deployed as separate services in Coolify (or any Docker host), each pointing at the same Git repo with a different Dockerfile.

---

## Beta / Staging Environment

Before deploying to production, test against a separate Supabase project so you never touch live data.

### How it works

One environment variable controls which Supabase project both the frontend and server connect to:

| `SUPABASE_ENV` value | Database used |
|---|---|
| omitted (default) | Production Supabase project |
| `beta` | Beta Supabase project |

The server logs `⚡ Running against BETA Supabase project` on startup when beta is active.

### Setting up a beta Supabase project

1. Create a new project in your Supabase dashboard
2. Run `supabase/schema.sql` in the SQL editor of the new project
3. Add the three beta secrets to your environment:

| Secret | Where to find it |
|---|---|
| `BETA_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `BETA_SUPABASE_ANON_KEY` | Same page → `anon public` key |
| `BETA_SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key |

4. Set `SUPABASE_ENV=beta` and restart the app

To return to production, delete `SUPABASE_ENV` (or set it to `production`) and restart.

> The beta project uses `text` columns throughout (fresh schema, no ENUM types), so none of the production cast-fix migrations are needed.

---

## Docker Builds

### Main app

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t traydbook .

docker run -p 3001:3001 \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e STRIPE_SECRET_KEY=... \
  -e STRIPE_WEBHOOK_SECRET=... \
  -e APP_ORIGIN=https://app.traydbook.com \
  -e NODE_ENV=production \
  traydbook
```

### Admin panel

```bash
docker build -f Dockerfile.admin \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t traydbook-admin .

docker run -p 4000:4000 \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e STRIPE_SECRET_KEY=... \
  -e ADMIN_ALLOWED_IPS=12.34.56.78,98.76.54.32 \
  -e NODE_ENV=production \
  traydbook-admin
```

`ADMIN_ALLOWED_IPS` is a comma-separated list of IPs allowed to access the admin panel. Any other IP receives a bare `403 Forbidden`. Leave empty to allow all (useful in dev).

### Pointing a container at the beta database

Add these to either `docker run` command:

```
-e SUPABASE_ENV=beta
-e BETA_SUPABASE_URL=...
-e BETA_SUPABASE_ANON_KEY=...
-e BETA_SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Coolify Setup

Coolify is the recommended production host. Create two separate applications from the same Git repository.

### Application 1 — Main Platform

| Setting | Value |
|---|---|
| Repository | your Git repo URL |
| Branch | `main` |
| Dockerfile path | `Dockerfile` |
| Port | `3001` |
| Domain | `app.traydbook.com` |

**Build Variables** (Vite bakes these at compile time — must be Build Variables, not env vars):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Environment Variables** (runtime):

```
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
APP_ORIGIN=https://app.traydbook.com
TELNYX_API_KEY=...
TELNYX_PHONE_NUMBER=...
SMS_STARTER_PRICE_ID=...
SMS_UNLIMITED_PRICE_ID=...
NODE_ENV=production
```

---

### Application 2 — Admin Panel

| Setting | Value |
|---|---|
| Repository | same Git repo URL |
| Branch | `main` |
| Dockerfile path | `Dockerfile.admin` |
| Port | `4000` |
| Domain | `admin.traydbook.com` |

**Build Variables**:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Environment Variables**:

```
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=...
ADMIN_ALLOWED_IPS=your.office.ip,your.home.ip
NODE_ENV=production
```

> `STRIPE_WEBHOOK_SECRET` is not needed on the admin container — webhooks only hit the main app.

---

## Full Environment Variable Reference

### Main app

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (Build Var) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (Build Var) | Supabase `anon public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase `service_role` key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `APP_ORIGIN` | Yes | Public URL (e.g. `https://app.traydbook.com`) |
| `TELNYX_API_KEY` | No | Telnyx API key (SMS feature) |
| `TELNYX_PHONE_NUMBER` | No | Telnyx sending number |
| `SMS_STARTER_PRICE_ID` | No | Stripe price ID for SMS Starter plan |
| `SMS_UNLIMITED_PRICE_ID` | No | Stripe price ID for SMS Unlimited plan |
| `SOLANA_TREASURY_PRIVATE_KEY` | No | Treasury wallet for admin reward sends |
| `NODE_ENV` | Yes | `production` |

### Admin panel

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes (Build Var) | Same production Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Yes (Build Var) | Same `anon public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Same `service_role` key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `ADMIN_ALLOWED_IPS` | Yes | Comma-separated IP allowlist (empty = no restriction) |
| `NODE_ENV` | Yes | `production` |

### Beta switching (both apps, optional)

| Variable | Description |
|---|---|
| `SUPABASE_ENV` | `beta` to use beta project; omit for production |
| `BETA_SUPABASE_URL` | Beta Supabase project URL |
| `BETA_SUPABASE_ANON_KEY` | Beta `anon public` key |
| `BETA_SUPABASE_SERVICE_ROLE_KEY` | Beta `service_role` key |

---

## Stripe Webhook Registration

Register a webhook in the Stripe dashboard under **Developers → Webhooks**:

- **Production**: `https://app.traydbook.com/api/stripe/webhook`
- **Dev / Beta**: `https://<your-dev-url>/api/stripe/webhook`

Each environment needs its own endpoint and its own `STRIPE_WEBHOOK_SECRET`.

Events to enable:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`

---

## Health Checks

Both containers expose `/healthz`:

- Main app: `http://app.traydbook.com/healthz`
- Admin panel: `http://admin.traydbook.com/healthz`

Coolify can use these as health check URLs.

---

## Deployment Roadmap

| Stage | Where | Notes |
|---|---|---|
| Development | Replit | Active builds, hot reload |
| Staging / Beta | Separate Docker container | `SUPABASE_ENV=beta`, safe to break |
| Production | Coolify — two apps from one repo | `app.traydbook.com` + `admin.traydbook.com` |
