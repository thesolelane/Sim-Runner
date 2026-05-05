# TraydBook

The professional network for the construction trades. Contractors, tradespeople, and design professionals can post work, find jobs, submit bids, and build verified reputations.

## Brand Identity
- **Name**: TraydBook — wordmark split as "Trayd" (bone white `#F0ECE6`) + "Book" (orange `#E85D04`)
- **Logo**: Stacked pages SVG icon on orange background
- **Theme**: Dark — Forge black `#141416` background, Steel surface `#22252A` cards
- **Fonts**: Barlow Condensed (headings, labels, UI) + Barlow (body text)
- **Brand color**: `#E85D04` (orange), press state `#C44D00`
- **Text colors**: Bone white `#F0ECE6`, Dust gray `#9D9990`, `#5A5750` for muted
- **Borders**: `#2E3033`

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Backend**: Supabase (auth + database)
- **Styling**: Pure CSS custom properties, no CSS framework
- **Routing**: React Router v6

## Supabase Config
- **URL**: `https://tpwrpezsvclzblktgjli.supabase.co`
- **Anon key**: stored as `VITE_SUPABASE_ANON_KEY` env var
- **JWT secret**: stored as `SUPABASE_JWT_SECRET`
- **DB password**: stored as `SUPABASE_DB_PASSWORD`
- **Schema**: `supabase/schema.sql` — run this in Supabase SQL Editor to create all tables

## User Types
- **Contractor / Tradesperson** — free always, full access
- **Design Professional** — free always, full access
- **Project Owner** — credit-based (50 welcome credits)
- **Real Estate Agent** — credit-based
- **Homeowner** — credit-based

## Credit Costs
- Post RFQ: 10 credits
- Post job (non-contractor): 8 credits
- Cold message contractor: 3 credits
- Request contact info: 5 credits
- Boost listing: 15 credits

## Key Files
- `src/lib/supabase.ts` — Supabase client
- `src/lib/database.types.ts` — TypeScript DB types
- `src/context/AuthContext.tsx` — Auth state & helpers
- `src/components/ProtectedRoute.tsx` — Route guard
- `src/components/Navbar.tsx` — Main navigation (auth-aware, live unread dots for messages + notifications)
- `src/data/trades.ts` — canonical `TRADE_OPTIONS` and `JOB_TYPE_OPTIONS` constants (used across Bids, EditProfile, PostRFQ)
- `src/types/feed.ts` — FeedPost, POST_TYPE_BADGE, FilterOption, SidebarUser types
- `src/pages/Feed.tsx` — Main feed (Supabase data + filter + compose + sidebars; no mock fallbacks)
- `src/components/PostCard.tsx` — Post card with type badge, inline comments, likes
- `src/components/FeedFilterBar.tsx` — Filter pill bar (URL-synced)
- `src/components/ComposeModal.tsx` — Compose modal with 4 post type flows
- `src/components/ReferModal.tsx` — Contractor search + referral post flow
- `src/pages/Explore.tsx` — Contractor discovery (/explore): search, filter sidebar, contractor cards, connect/message
- `src/pages/Messages.tsx` — Messages inbox (/messages): thread list with unread indicators + Realtime
- `src/pages/MessageThread.tsx` — Thread view (/messages/:threadId): chronological messages, send, credit gate, Realtime
- `src/pages/Notifications.tsx` — Notifications (/notifications): grouped Today/Week/Earlier, mark-all-read on load
- `src/pages/Landing.tsx` — Public landing page
- `src/pages/Login.tsx` — Sign in
- `src/pages/Signup.tsx` — Account type selection
- `src/pages/SignupContractor.tsx` — 3-step contractor onboarding
- `src/pages/SignupOwner.tsx` — 2-step owner/agent/homeowner onboarding
- `src/styles/feed.css` — Feed-specific styles (skeleton, compose trigger, spin)
- `src/styles/landing.css` — Landing page styles
- `src/styles/auth.css` — Auth page styles
- `src/index.css` — Global CSS variables + reset
- `supabase/schema.sql` — Full DB schema with RLS policies + RPCs (send_message, send_connection_request)
- `supabase/migrations/008_badge_system.sql` — Migration for badge_tier + vouches table
- `supabase/migrations/009_storage_avatars.sql` — Migration for avatars storage bucket + policies
- `supabase/migrations/010_social_links.sql` — Migration for social_links JSONB column on users
- `supabase/migrations/011_team_delegation.sql` — Migration for team delegation: account_delegations table, delegate_audit_log table, is_delegate + delegate_principal_id columns on users

## Social Login
- Google, Apple, LinkedIn OAuth via Supabase (requires enabling in Supabase dashboard)
- New OAuth users without a profile are redirected to `/onboarding` (pick account type, confirm name, choose trade if contractor)
- `src/pages/OAuthCallback.tsx` — handles OAuth redirect and routes to feed or onboarding
- `src/pages/Onboarding.tsx` — multi-step onboarding for new OAuth users
- `src/components/SocialAuthButtons.tsx` — shared social auth button component (Login + Signup pages)

## Verified Badge System
Three badge tiers for contractors:
- `pro_verified` — license + GL insurance + workers' comp (all verified) — orange badge
- `licensed` — contractor license verified — blue badge
- `vouched` — endorsed by a Pro Verified contractor — green badge

Badge is stored on `contractor_profiles.badge_tier`. Updated by admin or database trigger.
Contractors submit credentials (license, GL, WC) in Settings → "Verification & Badges".
Pro Verified contractors can vouch for others via the Vouch button on their profiles.
`src/components/VerifiedBadge.tsx` — badge display component (used on Profile, Explore cards)

## Post Types
- `project_update` → blue badge "Project Update"
- `bid_post` → orange badge "Open Bid"
- `job_post` + is_urgent → red badge "Urgent Hire"
- `trade_tip` → green badge "Trade Tip"
- `safety_alert` → yellow badge "Safety Alert"
- `referral` → purple badge "Referral"

## Stripe
- **Keys**: LIVE keys in use (`sk_live_...`) — real payments are charged
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` stored as Replit secrets
- **Email**: `customer_email` passed to Stripe checkout — Stripe automatically sends a payment receipt to this address after purchase
- **Webhook**: Must be registered in the Stripe dashboard under Developers → Webhooks
  - Dev (Replit): point to `https://<replit-dev-domain>/api/webhooks/stripe`
  - Production (own server): point to `https://yourdomain.com/api/webhooks/stripe`
  - Each environment needs its own webhook endpoint + its own `STRIPE_WEBHOOK_SECRET`
  - Listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`
- **Seed script**: `scripts/seed-stripe-products.js` — run once to create/update products in Stripe (idempotent, safe to re-run)

### Live Stripe Products & Prices

**One-time credit bundles** (`mode: 'payment'`)
| Bundle       | Credits | Price | Stripe Price ID                        | Stripe Product ID      |
|---|---|---|---|---|
| Starter      | 25 cr   | $9    | `price_1TEMD8CXFkuyP9oE1vVyWb2D`     | `prod_UClkf2uXvDLFsN` |
| Builder      | 75 cr   | $24   | `price_1TEMD9CXFkuyP9oEEtINcbiN`     | `prod_UClkweiFvm2VPM` |
| Professional | 200 cr  | $54   | `price_1TEMD9CXFkuyP9oEJKb5PKGL`     | `prod_UClkuhQHCsalUv` |
| Power        | 500 cr  | $99   | `price_1TEMDACXFkuyP9oEJxlOr18m`     | `prod_UClksIMbwsf3xh` |

**Monthly SMS subscriptions** (`mode: 'subscription'`)
| Plan        | Price      | Stripe Price ID (env secret)          |
|---|---|---|
| Starter     | $3.99/mo   | `SMS_STARTER_PRICE_ID`               |
| Unlimited   | $5.99/mo   | `SMS_UNLIMITED_PRICE_ID`             |

- ⚠️ Since live keys are active in Replit, avoid triggering the checkout flow during development — it will charge real cards

## SMS Message Alerts (Telnyx)
- **Telnyx SDK** sends SMS via `TELNYX_API_KEY` and `TELNYX_PHONE_NUMBER` secrets
- **Two-tier subscription** via Stripe: Starter ($3.99/mo, 150 SMS cap) and Unlimited ($5.99/mo, no cap)
- **Stripe Price IDs**: `SMS_STARTER_PRICE_ID` and `SMS_UNLIMITED_PRICE_ID` secrets (create recurring monthly products in Stripe dashboard)
- **OTP verification**: 6-digit code sent via Telnyx, SHA-256 hashed + 10min expiry stored in DB
- **Phone privacy**: Column-level REVOKE on `phone_number`, `sms_otp_hash`, etc. — only service_role can read
- **SMS dispatch**: Server-side Supabase realtime listener on `notifications` table (type=message_received) fires SMS to verified recipients
- **Settings UI**: SMS Alerts in Settings > Notifications tab (contractors only) — plan cards, OTP flow, pause/resume, cancel
- **Migration**: `supabase/migrations/011_sms_fields.sql`
- **Server endpoints**: `/api/sms/create-subscription`, `/api/sms/cancel-subscription`, `/api/sms/toggle-alerts`, `/api/sms/send-verification`, `/api/sms/verify`, `/api/sms/status`

## Beta / Staging Environment

A second Supabase project can be used as a staging environment without touching production data. One variable controls which project the app connects to — both frontend and server switch together.

### How to switch
Set `SUPABASE_ENV` in Replit Secrets:
- `production` (default, or omit entirely) → uses the main production Supabase project
- `beta` → uses the beta Supabase project

Then restart the app. The server will log `⚡ Running against BETA Supabase project` when beta is active.

### Required secrets for the beta project
Add these once (after creating a new Supabase project for beta):
| Secret | Where to find it |
|---|---|
| `BETA_SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
| `BETA_SUPABASE_ANON_KEY` | Same page → `anon public` key |
| `BETA_SUPABASE_SERVICE_ROLE_KEY` | Same page → `service_role` key |

### Setting up the beta database
Run `supabase/schema.sql` in the new beta project's SQL editor. That is all — the beta project uses `text` columns throughout (no ENUM types), so none of the production cast-fix migrations are needed.

### How it works in code
- `vite.config.ts` — reads `SUPABASE_ENV` at startup, injects the correct `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` into the frontend via `define`
- `server/lib/clients.js` — reads `SUPABASE_ENV` at startup, picks the correct URL and service-role key for all server-side Supabase calls

---

## Docker

Two Dockerfiles, one per deployable app. Both use a 2-stage build (Vite build stage → lean Node 20 Alpine runtime).

### Main app — `Dockerfile`
Builds `npm run build` → `dist/`, runs `server/index.js` on port 3001.

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t traydbook .

docker run -p 3001:3001 \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e STRIPE_SECRET_KEY=... \
  -e STRIPE_WEBHOOK_SECRET=... \
  traydbook
```

### Admin panel — `Dockerfile.admin`
Builds `npm run build:admin` → `admin-dist/`, runs `admin-server.js` on port 4000.

```bash
docker build -f Dockerfile.admin \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t traydbook-admin .

docker run -p 4000:4000 \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e STRIPE_SECRET_KEY=... \
  -e ADMIN_ALLOWED_IPS=12.34.56.78,98.76.54.32 \
  traydbook-admin
```

`ADMIN_ALLOWED_IPS` — comma-separated list of IPs allowed through; leave empty to allow all (useful in dev). Any other IP gets a bare `403 Forbidden`.

To point the admin container at the beta Supabase project, add:
```
-e SUPABASE_ENV=beta
-e BETA_SUPABASE_URL=...
-e BETA_SUPABASE_SERVICE_ROLE_KEY=...
```

---

## Standalone Admin Panel (`admin.traydbook.com`)

The admin panel is a fully separate deployable app — its own Vite build, its own Express server, its own domain.

### Files
- `admin-server.js` — standalone Express server (port 4000); IP allowlist middleware; serves `admin-dist/`; reuses `server/routes/admin.js`
- `admin-app/` — standalone Vite + React app
  - `admin-app/vite.config.ts` — root=admin-app/, `@main` alias → `src/`, AuthContext alias → admin shim; builds to `admin-dist/`
  - `admin-app/index.html` — HTML entry point
  - `admin-app/src/main.tsx` / `App.tsx` — React entry + auth gate
  - `admin-app/src/index.css` — same CSS variables/dark theme as main app
  - `admin-app/src/lib/supabase.ts` — Supabase client
  - `admin-app/src/context/AuthContext.tsx` — thin shim providing `useAuth()` (session only) so existing section components work unchanged
  - `admin-app/src/pages/Login.tsx` — admin login form; verifies admin role before granting access
  - `admin-app/src/pages/AdminPanel.tsx` — full panel layout; imports all section components from `src/pages/admin/` via `@main` alias

### Section components (shared with embedded `/admin` route in main app)
All sections live in `src/pages/admin/` and are imported by both the main app's `Admin.tsx` and the standalone admin panel:
- `OverviewSection.tsx` — platform analytics stats grid
- `UsersSection.tsx` — paginated user list, role change, suspend/reinstate
- `WalletsSection.tsx` — credit balances, manual adjustment
- `FeedSection.tsx` — recent posts/comments, flag queue, delete
- `ControlsSection.tsx` — staff invites, feature flags, announcements
- `PaymentsSection.tsx` — Stripe purchases, revenue totals
- `DomainsSection.tsx` — domain status cards
- `SecretsSection.tsx` — env var viewer/editor
- `ErrorLogSection.tsx` — server error log (super admin only)

### npm scripts
```
npm run dev:admin      # Vite on :4001 + admin server on :4000 (dev)
npm run build:admin    # builds admin-dist/
npm run start:admin    # production (serves admin-dist/ from admin-server.js)
```

### Deploying to admin.traydbook.com
Deploy as a second Replit (or Docker container). Required secrets are the same Supabase/Stripe keys as the main app plus `ADMIN_ALLOWED_IPS`.

---

## Deployment
All deployment files live in `deploy/` and must be updated as the app evolves (new env vars, new services, etc.):
- `deploy/UBUNTU_SETUP.md` — full Ubuntu 22.04 server setup guide (Node, PM2, Nginx, SSL)
- `deploy/WINDOWS_SETUP.md` — full Windows Server setup guide (same stack, Windows paths)
- `deploy/deploy.sh` — one-command Linux deploy script (git pull → build → PM2 reload)
- `deploy/deploy.ps1` — one-command Windows deploy script (PowerShell)
- `deploy/nginx.conf` — Nginx config for Ubuntu (static SPA + /api proxy + SSL-ready)
- `deploy/nginx-windows.conf` — same config for Windows paths
- `deploy/ecosystem.config.js` — PM2 process config (auto-restart, log paths)
- `deploy/.env.example` — template of every env var the server needs

### Deployment roadmap
1. **Now**: Replit (development + active builds)
2. **Beta**: Separate Replit or Docker container pointed at beta Supabase project (`SUPABASE_ENV=beta`)
3. **Production**: `app.traydbook.com` (main app) + `admin.traydbook.com` (admin panel) — separate deployments

### Required env vars — main app
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
APP_ORIGIN                 ← https://app.traydbook.com
TELNYX_API_KEY
TELNYX_PHONE_NUMBER
SMS_STARTER_PRICE_ID
SMS_UNLIMITED_PRICE_ID
NODE_ENV=production
```

### Required env vars — admin panel
```
VITE_SUPABASE_URL          ← same production Supabase project
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ADMIN_ALLOWED_IPS          ← comma-separated IP allowlist (empty = no restriction)
NODE_ENV=production
```

### Optional env vars (both apps — beta switching)
```
SUPABASE_ENV               ← "beta" or "production" (default production)
BETA_SUPABASE_URL
BETA_SUPABASE_ANON_KEY
BETA_SUPABASE_SERVICE_ROLE_KEY
```

## Team Delegation & Ghost Sub-Accounts (Task #12)
Non-public delegate accounts let company staff manage a company's TraydBook presence without shared passwords.
- Delegate accounts are flagged `is_delegate=true` + `delegate_principal_id` on the users table
- Delegates are invisible: excluded from Explore, no public profile page, no public handle
- When a delegate logs in, they operate entirely as the principal's account
- Two roles: **Admin** (post, message, bid, manage jobs) and **Contributor** (post only)
- Settings > Team tab: invite form with responsibility agreement, shows active members, pending invites, audit log, revoke button
- Invite link: `/join/:token` — simplified registration (name + password only, no public handle)
- Audit log: all delegate write actions recorded in `delegate_audit_log` (actual_user_id + acting_as_user_id)
- Server endpoints: `POST /api/team/invite`, `POST /api/team/revoke`, `GET /api/team`
- Responsibility agreement stored permanently with invitation record (admin user ID + timestamp + terms version)
- Key files: `src/pages/JoinDelegate.tsx`, `src/components/TeamPanel.tsx`

## Solana Wallet Integration (Task #15)
Contractor accounts automatically get a Solana wallet after signup/onboarding.
- Keypair generated **client-side** via `@solana/web3.js` — private key never touches the server
- `/wallet-setup` — full-page experience: displays wallet address + private key (Base58 + JSON array), copy/download buttons, security warning, required checkbox, beforeunload guard, POST pubkey to API then redirect to /feed
- Both `SignupContractor.tsx` and `Onboarding.tsx` (contractor path) redirect to `/wallet-setup` instead of `/feed`
- Non-contractor signups still go to `/feed` as normal
- **Settings > Crypto Wallet tab** (contractorOnly): active-wallet state (pubkey + QR code + remove/replace actions), no-wallet state (explainer + setup button)
- **Server endpoints**: `POST /api/wallet/save-pubkey` (validates Base58, contractor-only), `GET /api/wallet/status`, `POST /api/wallet/remove`, `POST /api/wallet/send-reward` (admin-only, uses SOLANA_TREASURY_PRIVATE_KEY from env)
- **Migration**: `supabase/migrations/015_solana_wallet.sql` — adds `solana_pubkey TEXT UNIQUE NULL` to `users` table
- **New packages**: `@solana/web3.js`, `qrcode.react`, `buffer` (browser polyfill)
- **Vite config**: `buffer` polyfill + `global: globalThis` define for @solana/web3.js browser compatibility
- **Key files**: `src/pages/WalletSetup.tsx`, `server/routes/wallet.js` (wallet endpoints), `src/pages/settings/WalletTab.tsx`

## Server File Structure
Server code is split into focused modules (was previously one 1300-line `server/index.js`):
- `server/index.js` — thin entry (~78 lines): mounts routers, starts notification listener
- `server/lib/clients.js` — Supabase admin/anon, Stripe, Telnyx, BUNDLES, SMS_PLANS, env vars
- `server/lib/auth.js` — `requireAuth`, `requireSuperAdmin`, `requireAdminLevel` middleware
- `server/routes/stripe.js` — Stripe webhook + `/api/create-checkout-session` + `/api/session-status`
- `server/routes/team.js` — `/api/team/*` (invite, revoke, list)
- `server/routes/admin.js` — `/api/admin/*` (stats, users, posts, comments, wallets, credits, purchases)
- `server/routes/sms.js` — `/api/sms/*` + exported `sendSmsAlert()` for notification listener
- `server/routes/wallet.js` — `/api/wallet/*` (save-pubkey, status, remove, send-reward)

## Settings Page File Structure
Settings page is split into tab components (was previously one 3046-line `src/pages/Settings.tsx`):
- `src/pages/Settings.tsx` — thin shell (~240 lines): sidebar nav, tab routing, visibility rules per account type
- `src/pages/settings/shared.tsx` — shared helpers: `SavedBanner`, `ErrorBanner`, `TabHeading`, `SectionHeading`, `Section`, `inputStyle`, `btnPrimary`, `btnGhost`, `apiFetch`
- `src/pages/settings/AccountTab.tsx` — email change, password change, profile summary, credit balance link
- `src/pages/settings/NotificationsTab.tsx` — 13 notification toggles, SMS alerts subscription (contractors only)
- `src/pages/settings/PrivacyTab.tsx` — explore visibility toggle (contractors only)
- `src/pages/settings/BillingTab.tsx` — credit balance, buy bundles (Stripe), credit ledger (non-contractors only)
- `src/pages/settings/VerificationTab.tsx` — badge display, credential submission flow (contractors only)
- `src/pages/settings/WalletTab.tsx` — Solana wallet: pubkey display, QR code, copy, remove, setup prompt (contractors only)
- `src/pages/settings/DangerTab.tsx` — account deletion with CONFIRM gate

## Admin Panel File Structure
Admin page is split into section components (was previously one 1113-line `src/pages/Admin.tsx`):
- `src/pages/Admin.tsx` — thin shell (~70 lines): sidebar nav, section routing, auth headers
- `src/pages/admin/shared.tsx` — SectionCard, StatCard, AdminInput, LoadingRow, formatDate, formatDollars, table styles
- `src/pages/admin/OverviewSection.tsx` — platform analytics (stats grid)
- `src/pages/admin/UsersSection.tsx` — paginated user list, role change, suspend/reinstate
- `src/pages/admin/WalletsSection.tsx` — credit balances, manual credit adjustment
- `src/pages/admin/FeedSection.tsx` — recent posts/comments, flag queue, delete actions
- `src/pages/admin/ControlsSection.tsx` — staff invites, feature flags, platform announcements
- `src/pages/admin/PaymentsSection.tsx` — Stripe purchases, revenue totals
- `src/pages/admin/DomainsSection.tsx` — domain status cards, environment labels

## Task Status
- ✅ Task #1: Auth, Database & Routing Foundation — DONE
- ✅ Task #2: Feed Overhaul (post types, compose, filters) — DONE
- ✅ Task #3: Full Profile System — DONE
- ✅ Task #4: Full Bid Board — RFQ Marketplace — DONE
- ✅ Task #5: Job Board — detail pages, post form & filters — DONE
- ✅ Task #6: Explore, Messages & Notifications — DONE
- ✅ Task #7: Credits, Stripe & Settings — DONE
- ✅ Task #8: Social Login + Verified Badge System — DONE
- ✅ Task #8 (Profile Polish): Social Links & Avatar Validation — DONE
- ✅ Task #9: SMS Message Alerts (Telnyx, two-tier subscription) — DONE
- ✅ Task #12: Team Delegation & Ghost Sub-Accounts — DONE
- ✅ Task #15: Solana Wallet Integration (Contractor Accounts) — DONE
- ✅ End-to-End Simulation: 112/112 checks passing — DONE

## Live DB vs schema.sql Differences (discovered during simulation)
The live staging DB (dev.traydbook.com) has several columns as ENUM types that schema.sql defines as text. Always use the enum values below when writing migrations or RPCs:

| Column | Table | Enum type | Valid values |
|---|---|---|---|
| `transaction_type` | `credit_ledger` | `transaction_type` | `purchase, post_rfq, post_job, send_message, request_contact, boost_listing, repost_listing, verification_fee, refund, admin_adjustment` |
| `type` | `notifications` | `notification_type` | `connection_request, connection_accepted, post_liked, post_commented, bid_received, bid_awarded, bid_not_awarded, job_application, rfq_closing_soon, credential_expiring, referral_received, safety_alert, message_received, credits_added, profile_viewed` |
| `status` | `rfqs` | `rfq_status` | `open, awarded, closed, cancelled, draft` |
| `osha_required` | `rfqs` | `osha_requirement` | `none, osha_10, osha_30` |
| `account_type` | `users` | `account_type` | `contractor, design_professional, project_owner, agent, homeowner, admin` |
| `status` | `bids` | `bid_status` | `pending, under_review, awarded, not_awarded, withdrawn` |
| `post_type` | `posts` | `post_type` | `project_update, job_post, bid_post, trade_tip, safety_alert, referral, story` |

**notifications table**: does NOT have a `title` column in the live DB — only `user_id, type, body, entity_id, entity_type, is_read, created_at`.

## Simulation
- Script: `scripts/simulate.mjs` — reads env vars first, falls back to hardcoded staging defaults
- Manual run on Coolify host: `NODE_TLS_REJECT_UNAUTHORIZED=0 node /tmp/sim.mjs`
- 112 checks: health, auth guards, create/signin/onboard 10 users, image uploads, posts, comments, likes, fund credits, post RFQs, submit bids, award bid, wallet access, cleanup
- Migrations to apply in Supabase SQL Editor (in order): 021 → 022 → ... → 029

### Automatic post-deploy webhook (Coolify)
The app exposes two protected endpoints for Coolify to trigger automatically after every deploy:

| Endpoint | Purpose |
|---|---|
| `POST /api/internal/run-sim?secret=TOKEN` | Trigger simulation (returns 202 immediately, runs in background) |
| `GET  /api/internal/sim-results?secret=TOKEN` | View last 20 run results |

**Coolify setup** (one-time, in Coolify dashboard → your app → Settings):
1. Find the **Post-deployment Webhook** field
2. Set it to: `https://dev.traydbook.com/api/internal/run-sim?secret=<SIM_WEBHOOK_SECRET>`
3. The `SIM_WEBHOOK_SECRET` value is stored in Replit env vars — check the Secrets tab

Results are saved to `.local/sim_results.json` and logged to the server console:
```
[sim] ✅ Run abc123 — 112/112 passed — 87.4s
```

**Why it works on Coolify but not in Replit dev**: the sim script connects to `dev.traydbook.com` — reachable from the Coolify server (it's the app itself) but not from Replit's isolated dev container.
