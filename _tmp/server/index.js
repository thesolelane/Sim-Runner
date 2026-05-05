import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './lib/clients.js'
import stripeRoutes from './routes/stripe.js'
import teamRoutes from './routes/team.js'
import adminRoutes from './routes/admin.js'
import smsRoutes, { sendSmsAlert } from './routes/sms.js'
import walletRoutes from './routes/wallet.js'
import onboardingRoutes from './routes/onboarding.js'
import uploadRoutes from './routes/upload.js'
import postRoutes from './routes/posts.js'
import simRoutes from './routes/sim.js'
import { logError, loadLogFromDisk } from './lib/errorLog.js'

const app = express()

app.use(stripeRoutes)

// Health check for Coolify / load balancers
app.get('/healthz', (_req, res) => res.json({ ok: true }))

app.use(express.json())

app.use((req, res, next) => {
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      const context = req.path.split('/')[2] ?? 'server'
      logError({
        context,
        message: `${res.statusCode} ${req.method} ${req.path}`,
        detail: null,
        route: req.path,
        method: req.method,
        statusCode: res.statusCode,
        userId: req.user?.id ?? null,
      })
    }
  })
  next()
})

app.use(teamRoutes)
app.use(adminRoutes)
app.use(simRoutes)
app.use(smsRoutes)
app.use(walletRoutes)
app.use(onboardingRoutes)
app.use('/api/upload', uploadRoutes)
app.use('/api/posts', postRoutes)

if (process.env.NODE_ENV === 'production') {
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.default.dirname(fileURLToPath(import.meta.url))
  const distPath = path.default.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.use((req, res) => {
    res.sendFile(path.default.join(distPath, 'index.html'))
  })
}

app.use((err, req, res, next) => {
  const message = err?.message ?? 'Internal server error'
  const stack = err?.stack ?? null
  const context = req.path.split('/')[2] ?? 'server'
  logError({
    context,
    message,
    detail: String(err),
    stack,
    route: req.path,
    method: req.method,
    statusCode: 500,
    userId: req.user?.id ?? null,
  })
  console.error(`[error] ${req.method} ${req.path} —`, message)
  if (!res.headersSent) res.status(500).json({ error: message })
})

process.on('uncaughtException', err => {
  logError({
    context: 'server',
    message: err.message,
    stack: err.stack,
    detail: 'uncaughtException',
  })
  console.error('[uncaughtException]', err)
})

process.on('unhandledRejection', reason => {
  const msg = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : null
  logError({ context: 'server', message: msg, stack, detail: 'unhandledRejection' })
  console.error('[unhandledRejection]', reason)
})

const PORT = process.env.PORT ?? process.env.API_PORT ?? 3001
app.listen(PORT, () => {
  console.log(
    `[server] Running on http://localhost:${PORT} (${process.env.NODE_ENV ?? 'development'})`
  )
  loadLogFromDisk()
  ensurePostMediaBucket()
  startNotificationListener()
})

async function ensurePostMediaBucket() {
  if (!SUPABASE_SERVICE_ROLE_KEY) return
  const { error } = await supabaseAdmin.storage.createBucket('post-media', {
    public: true,
    fileSizeLimit: 10485760, // 10 MB per file
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  })
  if (error && !error.message.includes('already exists')) {
    console.error('[storage] Failed to ensure post-media bucket:', error.message)
  } else {
    console.log('[storage] post-media bucket ready')
  }
}

function startNotificationListener() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('[sms-listener] SUPABASE_SERVICE_ROLE_KEY not set — SMS dispatch disabled')
    return
  }

  const listenerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  listenerClient
    .channel('server-notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'type=eq.message_received',
      },
      async payload => {
        const notif = payload.new
        if (!notif) return

        const recipientId = notif.user_id
        const entityId = notif.entity_id
        const entityType = notif.entity_type ?? ''
        const threadId = entityType.startsWith('thread:') ? entityType.slice(7) : null

        const { data: sender } = await supabaseAdmin
          .from('users')
          .select('display_name')
          .eq('id', entityId)
          .single()

        const senderName = sender?.display_name ?? 'Someone'
        sendSmsAlert(recipientId, senderName, threadId ?? '').catch(() => {})
      }
    )
    .subscribe(status => {
      if (status === 'SUBSCRIBED') {
        console.log('[sms-listener] Listening for message_received notifications')
      } else if (status === 'CHANNEL_ERROR') {
        console.error('[sms-listener] Channel error — SMS dispatch may be unavailable')
      }
    })
}
