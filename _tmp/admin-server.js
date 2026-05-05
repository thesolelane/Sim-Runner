import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { supabaseAdmin } from './server/lib/clients.js'
import adminRoutes from './server/routes/admin.js'
import { logError, loadLogFromDisk } from './server/lib/errorLog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT ?? process.env.ADMIN_PORT ?? 4000

// ── IP Allowlist ──────────────────────────────────────────────────────────────
// Set ADMIN_ALLOWED_IPS as a comma-separated list in your secrets.
// Leave it unset (or empty) during local dev to allow all traffic.
const rawIps = process.env.ADMIN_ALLOWED_IPS ?? ''
const ALLOWED_IPS = rawIps
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

function ipRestriction(req, res, next) {
  if (ALLOWED_IPS.length === 0) return next()
  const forwarded = req.headers['x-forwarded-for']
  const clientIp = (forwarded ? forwarded.split(',')[0] : (req.socket.remoteAddress ?? '')).trim()
  const isLoopback =
    clientIp === '::1' || clientIp === '127.0.0.1' || clientIp === '::ffff:127.0.0.1'
  if (isLoopback || ALLOWED_IPS.includes(clientIp)) return next()
  console.warn(`[admin] Blocked IP: ${clientIp}`)
  return res.status(403).send('Forbidden')
}

// Health check — must be BEFORE IP restriction so Coolify can reach it
app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.use(ipRestriction)

// ── Logging ───────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logError({
        context: req.path.split('/')[2] ?? 'admin-server',
        message: `${res.statusCode} ${req.method} ${req.path}`,
        detail: null,
        route: req.path,
        method: req.method,
        statusCode: res.statusCode,
      })
    }
  })
  next()
})

app.use(express.json())

// ── Admin API Routes ──────────────────────────────────────────────────────────
app.use(adminRoutes)

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/admin-health', (_req, res) =>
  res.json({ ok: true, env: process.env.SUPABASE_ENV ?? 'production' })
)

// ── Serve built admin app in production ───────────────────────────────────────
const ADMIN_DIST = path.join(__dirname, 'admin-dist')
app.use(express.static(ADMIN_DIST))
app.use((_req, res) => {
  res.sendFile(path.join(ADMIN_DIST, 'index.html'))
})

void loadLogFromDisk()

app.listen(PORT, () => {
  const env = process.env.SUPABASE_ENV ?? 'production'
  const ips = ALLOWED_IPS.length ? ALLOWED_IPS.join(', ') : 'all (no restriction)'
  console.log(`[admin-server] Listening on :${PORT}`)
  console.log(`[admin-server] Supabase env: ${env}`)
  console.log(`[admin-server] Allowed IPs: ${ips}`)
})
