# TraydBook

The professional network for the construction trades. Contractors, tradespeople, and design professionals can post work, find jobs, submit bids, and build verified reputations.

## What It Is

TraydBook is a two-sided marketplace and social platform for the construction industry:

- **Contractors / Tradespeople** — always free; post updates, submit bids, find jobs, build reputation
- **Project Owners / Agents / Homeowners** — credit-based; post RFQs and job listings, message contractors

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Express (Node 20) |
| Database & Auth | Supabase (PostgreSQL + RLS + Realtime) |
| Payments | Stripe (one-time credits + SMS subscriptions) |
| SMS | Telnyx |
| Crypto | Solana (@solana/web3.js) |
| Styling | Pure CSS custom properties — no framework |

## Local Development

### Prerequisites

- Node 20+
- A Supabase project (free tier works)
- Stripe account (test keys for dev)

### Setup

```bash
npm install
cp deploy/.env.example .env
# Fill in .env values, then:
npm run dev
```

Vite runs on port 5000, Express on port 3001. Vite proxies `/api` → Express.

### Database

Run `supabase/schema.sql` in your Supabase project's SQL editor to create all tables, RLS policies, and RPCs. Then apply any migrations in `supabase/migrations/` in numbered order.

## Environment Variables

### Required — main app

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase `anon public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase `service_role` key (server-side only) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `APP_ORIGIN` | Public URL of the app (e.g. `https://app.traydbook.com`) |

### Optional

| Variable | Description |
|---|---|
| `TELNYX_API_KEY` | Telnyx API key (SMS alerts feature) |
| `TELNYX_PHONE_NUMBER` | Telnyx sending number |
| `SMS_STARTER_PRICE_ID` | Stripe price ID — SMS Starter plan |
| `SMS_UNLIMITED_PRICE_ID` | Stripe price ID — SMS Unlimited plan |
| `SOLANA_TREASURY_PRIVATE_KEY` | Treasury wallet private key (admin reward sends) |

### Beta / Staging Environment

Flip the entire app to a second Supabase project without touching production data:

| Variable | Description |
|---|---|
| `SUPABASE_ENV` | Set to `beta` to use the beta project; omit for production |
| `BETA_SUPABASE_URL` | Beta project URL |
| `BETA_SUPABASE_ANON_KEY` | Beta `anon public` key |
| `BETA_SUPABASE_SERVICE_ROLE_KEY` | Beta `service_role` key |

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full switching guide.

## Credit System

Contractors are always free. Non-contractors purchase credits to post and message.

| Action | Cost |
|---|---|
| Post RFQ | 10 credits |
| Post job listing | 8 credits |
| Cold message a contractor | 3 credits |
| Request contact info | 5 credits |
| Boost listing | 15 credits |

### Credit Bundles (Stripe — Live Keys)

| Bundle | Credits | Price |
|---|---|---|
| Starter | 25 | $9 |
| Builder | 75 | $24 |
| Professional | 200 | $54 |
| Power | 500 | $99 |

## Verified Badge System

| Badge | Requirements | Color |
|---|---|---|
| Pro Verified | License + GL insurance + workers' comp all verified | Orange |
| Licensed | Contractor license verified | Blue |
| Vouched | Endorsed by a Pro Verified contractor | Green |

Admins verify credentials via the admin panel. Pro Verified contractors can vouch for others.

## Stripe Webhooks

Register a webhook in the Stripe dashboard pointing to:

```
https://app.traydbook.com/api/stripe/webhook
```

Events to listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`

Each environment needs its own webhook endpoint and its own `STRIPE_WEBHOOK_SECRET`.

## Social Login

Google, Apple, and LinkedIn OAuth via Supabase. Enable each provider in your Supabase dashboard under Authentication → Providers. Add the redirect URL:

```
https://app.traydbook.com/auth/callback
```

## Project Structure

```
src/
  pages/            Route-level page components
  pages/admin/      Admin panel sections (shared with standalone admin)
  pages/settings/   Settings tab components
  components/       Shared UI components
  context/          React contexts (Auth)
  lib/              Supabase client, DB types, roles, helpers
  styles/           Global and page-level CSS

server/
  index.js          Express entry — mounts all routers
  lib/
    auth.js         requireAuth / requireAdminLevel middleware
    clients.js      Supabase, Stripe, Telnyx clients + env switching
  routes/
    admin.js        /api/admin/*
    stripe.js       /api/stripe/*, webhook
    team.js         /api/team/*
    sms.js          /api/sms/*
    wallet.js       /api/wallet/*

admin-app/          Standalone admin panel (admin.traydbook.com)
supabase/
  schema.sql        Full DB schema — run once per Supabase project
  migrations/       Incremental migrations — apply in order
deploy/             Deploy scripts, Nginx config, PM2 config, env template
```

## Admin Panel

A separate deployable app lives at `admin.traydbook.com`:

- Built with `Dockerfile.admin` via `npm run build:admin`
- IP-restricted to `ADMIN_ALLOWED_IPS` (comma-separated; leave empty in dev)
- Sections: Overview, Users, Wallets, Feed, Controls, Payments, Domains

See [DEPLOYMENT.md](DEPLOYMENT.md) for setup.

## Deployments

| Domain | App |
|---|---|
| `app.traydbook.com` | Main platform (`Dockerfile`) |
| `admin.traydbook.com` | Admin panel (`Dockerfile.admin`) |

Both are built from the same repository. See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.
