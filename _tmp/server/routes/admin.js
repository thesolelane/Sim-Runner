import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth, requireSuperAdmin, requireAdminLevel, ALL_INVITE_ROLES } from '../lib/auth.js'
import { logError, getErrorLog, clearErrorLog } from '../lib/errorLog.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_FILE = path.join(__dirname, '../../.env')

// Known TraydBook env var keys (defines the fixed rows in the secrets panel)
const KNOWN_KEYS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'APP_ORIGIN',
  'TELNYX_API_KEY',
  'TELNYX_PHONE_NUMBER',
  'SMS_STARTER_PRICE_ID',
  'SMS_UNLIMITED_PRICE_ID',
  'PORT',
  'NODE_ENV',
]

function parseEnvFile() {
  const map = new Map()
  if (!fs.existsSync(ENV_FILE)) return map
  const lines = fs.readFileSync(ENV_FILE, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    map.set(key, val)
  }
  return map
}

function writeEnvFile(map) {
  const lines = []
  for (const [key, val] of map.entries()) {
    lines.push(`${key}=${val}`)
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', 'utf8')
}

function maskValue(val) {
  if (!val) return ''
  if (val.length <= 6) return '••••••'
  return val.slice(0, 3) + '•'.repeat(Math.min(val.length - 6, 20)) + val.slice(-3)
}

const router = Router()

// ── Admin Invites ─────────────────────────────────────────────────────────────

router.post('/api/admin/invite', requireAuth, requireSuperAdmin, async (req, res) => {
  const { email, role } = req.body ?? {}
  if (!email || !role) return res.status(400).json({ error: 'email and role are required' })
  if (!ALL_INVITE_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' })

  const { data: invite, error: insertErr } = await supabaseAdmin
    .from('admin_invites')
    .insert({ invited_by: req.user.id, email: email.trim().toLowerCase(), role })
    .select('id, token, email, role, expires_at')
    .single()

  if (insertErr) {
    console.error('[admin/invite] Insert error:', insertErr.message)
    return res.status(500).json({ error: 'Failed to create invite' })
  }

  const domain = process.env.REPLIT_DEV_DOMAIN ?? 'traydbook.com'
  const joinUrl = `https://${domain}/staff-invite/${invite.token}`
  console.log(
    `[admin/invite] Invite created for ${email} (${role}) by ${req.user.id}. URL: ${joinUrl}`
  )
  res.json({ invite, joinUrl })
})

router.get('/api/admin/invite/:token', async (req, res) => {
  const { token } = req.params
  const { data: invite, error } = await supabaseAdmin
    .from('admin_invites')
    .select(
      'id, email, role, expires_at, used_at, invited_by, users!invited_by (display_name, avatar_url)'
    )
    .eq('token', token)
    .maybeSingle()

  if (error || !invite) return res.status(404).json({ error: 'Invite not found or already used' })
  if (invite.used_at) return res.status(410).json({ error: 'This invite has already been used' })
  if (new Date(invite.expires_at) < new Date())
    return res.status(410).json({ error: 'This invite has expired' })

  res.json({ invite })
})

router.get('/api/admin/invites', requireAuth, requireSuperAdmin, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('admin_invites')
    .select('id, email, role, expires_at, used_at, created_at, users!invited_by (display_name)')
    .eq('invited_by', req.user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  res.json({ invites: data ?? [] })
})

router.delete('/api/admin/invite/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin
    .from('admin_invites')
    .delete()
    .eq('id', id)
    .eq('invited_by', req.user.id)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
})

// ── Admin Dashboard ───────────────────────────────────────────────────────────

router.get('/api/admin/stats', requireAuth, requireAdminLevel, async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { count: adminCount },
      { count: contractorCount },
      { count: ownerCount },
      { count: postCount },
      { count: jobCount },
      { count: rfqCount },
      { count: bidCount },
      { data: ledgerData },
      { count: recentSignups },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .in('account_type', ['admin', 'admin_2']),
      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('account_type', 'contractor'),
      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .in('account_type', ['project_owner', 'homeowner', 'agent']),
      supabaseAdmin.from('posts').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('job_listings').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('rfqs').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('bids').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('credit_ledger').select('delta, transaction_type'),
      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
    ])

    let totalCreditsIssued = 0
    let totalCreditSpent = 0
    for (const row of ledgerData ?? []) {
      if (row.transaction_type === 'purchase' || row.transaction_type === 'refund') {
        totalCreditsIssued += row.delta
      } else if (row.delta < 0) {
        totalCreditSpent += Math.abs(row.delta)
      }
    }

    res.json({
      totalUsers: totalUsers ?? 0,
      adminCount: adminCount ?? 0,
      contractorCount: contractorCount ?? 0,
      ownerCount: ownerCount ?? 0,
      postCount: postCount ?? 0,
      jobCount: jobCount ?? 0,
      rfqCount: rfqCount ?? 0,
      bidCount: bidCount ?? 0,
      totalCreditsIssued,
      totalCreditSpent,
      recentSignups: recentSignups ?? 0,
    })
  } catch (err) {
    console.error('[admin/stats]', err.message)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})

router.get('/api/admin/users', requireAuth, requireAdminLevel, async (req, res) => {
  const { search, role, page = '0' } = req.query
  const PAGE_SIZE = 25
  const offset = parseInt(page, 10) * PAGE_SIZE

  try {
    let q = supabaseAdmin
      .from('users')
      .select(
        'id, display_name, handle, avatar_url, account_type, credit_balance, created_at, deleted_at'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (search) q = q.or(`display_name.ilike.%${search}%,handle.ilike.%${search}%`)
    if (role) q = q.eq('account_type', role)

    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })
    res.json({ users: data ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.patch('/api/admin/user/:id/role', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { role } = req.body ?? {}
  if (!role || !ALL_INVITE_ROLES.includes(role))
    return res.status(400).json({ error: 'Invalid role' })

  const { data: targetUser, error: targetErr } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', id)
    .single()
  if (targetErr || !targetUser) return res.status(404).json({ error: 'Target user not found' })

  const actorIsAdmin2 = req.adminUser.account_type === 'admin_2'
  const targetIsAdminLevel = ['admin', 'admin_2'].includes(targetUser.account_type)
  const newRoleIsAdminLevel = ['admin', 'admin_2'].includes(role)

  if (actorIsAdmin2 && (targetIsAdminLevel || newRoleIsAdminLevel)) {
    return res.status(403).json({ error: 'admin_2 cannot assign or demote admin-level roles' })
  }

  const { error } = await supabaseAdmin.from('users').update({ account_type: role }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  console.log(
    `[admin/role] User ${id} role changed from ${targetUser.account_type} to ${role} by ${req.user.id}`
  )
  res.json({ ok: true })
})

router.patch('/api/admin/user/:id/suspend', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { suspend } = req.body ?? {}

  if (id === req.user.id) return res.status(400).json({ error: 'Cannot suspend your own account' })

  const { data: targetUser, error: targetErr } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', id)
    .single()
  if (targetErr || !targetUser) return res.status(404).json({ error: 'Target user not found' })

  if (
    req.adminUser.account_type === 'admin_2' &&
    ['admin', 'admin_2'].includes(targetUser.account_type)
  ) {
    return res
      .status(403)
      .json({ error: 'admin_2 cannot suspend or reinstate admin-level accounts' })
  }

  const { error } = await supabaseAdmin
    .from('users')
    .update({ deleted_at: suspend ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  console.log(
    `[admin/suspend] User ${id} ${suspend ? 'suspended' : 'reinstated'} by ${req.user.id}`
  )
  res.json({ ok: true })
})

router.post('/api/admin/credits', requireAuth, requireAdminLevel, async (req, res) => {
  const { userId, delta, reason } = req.body ?? {}
  if (!userId || typeof delta !== 'number' || delta === 0 || !reason?.trim()) {
    return res.status(400).json({ error: 'userId, non-zero delta, and reason are required' })
  }

  const { data: userRow, error: fetchErr } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single()
  if (fetchErr || !userRow) return res.status(404).json({ error: 'User not found' })

  const newBalance = userRow.credit_balance + delta
  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({ credit_balance: newBalance })
    .eq('id', userId)
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  await supabaseAdmin.from('credit_ledger').insert({
    user_id: userId,
    delta,
    balance_after: newBalance,
    transaction_type: delta > 0 ? 'refund' : 'spend',
    description: `Admin adjustment: ${reason} (by ${req.user.id})`,
  })

  console.log(
    `[admin/credits] Adjusted ${delta} credits for user ${userId} by admin ${req.user.id}. New balance: ${newBalance}`
  )
  res.json({ ok: true, balance: newBalance })
})

router.get('/api/admin/purchases', requireAuth, requireAdminLevel, async (req, res) => {
  const { status } = req.query
  try {
    let q = supabaseAdmin
      .from('purchases')
      .select(
        'id, user_id, credits, amount_cents, status, created_at, users!user_id(display_name, handle)'
      )
      .order('created_at', { ascending: false })
      .limit(100)
    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return res.status(500).json({ error: error.message })

    const { data: allPurchases } = await supabaseAdmin
      .from('purchases')
      .select('status, amount_cents')
    const all = allPurchases ?? []
    const totals = {
      completed: all.filter(r => r.status === 'completed').length,
      failed: all.filter(r => r.status === 'failed').length,
      totalCents: all.filter(r => r.status === 'completed').reduce((s, r) => s + r.amount_cents, 0),
    }

    res.json({ purchases: data ?? [], totals })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/admin/posts', requireAuth, requireAdminLevel, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(
        'id, body, post_type, like_count, comment_count, created_at, is_flagged, author:users!author_id(display_name, handle)'
      )
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ posts: data ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/admin/comments', requireAuth, requireAdminLevel, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('comments')
      .select('id, body, post_id, created_at, author:users!author_id(display_name, handle)')
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ comments: data ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/api/admin/post/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin.from('posts').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  console.log(`[admin/post] Post ${id} deleted by admin ${req.user.id}`)
  res.json({ ok: true })
})

router.patch('/api/admin/post/:id/flag', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { flagged } = req.body ?? {}
  const { error } = await supabaseAdmin.from('posts').update({ is_flagged: !!flagged }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  console.log(
    `[admin/post] Post ${id} ${flagged ? 'flagged' : 'unflagged'} by admin ${req.user.id}`
  )
  res.json({ ok: true })
})

router.get('/api/admin/flagged-posts', requireAuth, requireAdminLevel, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('posts')
      .select(
        'id, body, post_type, like_count, comment_count, created_at, is_flagged, author:users!author_id(display_name, handle)'
      )
      .eq('is_flagged', true)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return res.status(500).json({ error: error.message })
    res.json({ posts: data ?? [] })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/api/admin/comment/:id', requireAuth, requireAdminLevel, async (req, res) => {
  const { id } = req.params
  const { error } = await supabaseAdmin.from('comments').delete().eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  console.log(`[admin/comment] Comment ${id} deleted by admin ${req.user.id}`)
  res.json({ ok: true })
})

router.get('/api/admin/wallets', requireAuth, requireAdminLevel, async (req, res) => {
  try {
    const { data: users, error: uErr } = await supabaseAdmin
      .from('users')
      .select('id, display_name, handle, credit_balance')
      .order('credit_balance', { ascending: false })
      .limit(100)
    if (uErr) return res.status(500).json({ error: uErr.message })

    let wallets = []
    try {
      const { data: walletsData, error: wErr } = await supabaseAdmin
        .from('solana_wallets')
        .select('user_id, wallet_address, network')
      if (!wErr && walletsData) wallets = walletsData
    } catch {
      // table does not exist — continue with empty wallet list
    }

    const walletMap = new Map(wallets.map(w => [w.user_id, w]))
    const result = (users ?? []).map(u => ({
      ...u,
      wallet_address: walletMap.get(u.id)?.wallet_address ?? null,
      wallet_network: walletMap.get(u.id)?.network ?? null,
    }))

    res.json({ wallets: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Secrets Management ────────────────────────────────────────────────────────

router.get('/api/admin/secrets', requireAuth, requireSuperAdmin, (req, res) => {
  const fileMap = parseEnvFile()
  const secrets = KNOWN_KEYS.map(name => {
    const fileVal = fileMap.get(name)
    const liveVal = process.env[name]
    const val = fileVal ?? liveVal ?? ''
    return {
      name,
      set: Boolean(val),
      masked: maskValue(val),
      source: fileVal ? 'file' : liveVal ? 'env' : 'unset',
    }
  })
  // Also include any extra keys in the .env file not in KNOWN_KEYS
  for (const [key, val] of fileMap.entries()) {
    if (!KNOWN_KEYS.includes(key)) {
      secrets.push({ name: key, set: Boolean(val), masked: maskValue(val), source: 'file' })
    }
  }
  res.json({ secrets })
})

router.put('/api/admin/secrets', requireAuth, requireSuperAdmin, (req, res) => {
  const { name, value } = req.body ?? {}
  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' })
  if (typeof value !== 'string') return res.status(400).json({ error: 'value is required' })
  if (!/^[A-Z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Invalid key name' })

  const map = parseEnvFile()
  map.set(name, value)
  writeEnvFile(map)
  process.env[name] = value
  console.log(`[secrets] Set ${name} (by ${req.user.id})`)
  res.json({ ok: true })
})

router.delete('/api/admin/secrets/:name', requireAuth, requireSuperAdmin, (req, res) => {
  const { name } = req.params
  if (!/^[A-Z0-9_]+$/.test(name)) return res.status(400).json({ error: 'Invalid key name' })

  const map = parseEnvFile()
  const existed = map.has(name)
  map.delete(name)
  writeEnvFile(map)
  delete process.env[name]
  console.log(`[secrets] Deleted ${name} (by ${req.user.id})`)
  res.json({ ok: true, existed })
})

// ─── Error Log ────────────────────────────────────────────────────────────────

router.get('/api/admin/error-log', requireAuth, requireSuperAdmin, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '100'), 500)
  const offset = parseInt(req.query.offset ?? '0')
  const context = req.query.context?.toString() || undefined
  res.json(getErrorLog({ limit, offset, context }))
})

router.delete('/api/admin/error-log', requireAuth, requireSuperAdmin, (req, res) => {
  clearErrorLog()
  console.log(`[admin] Error log cleared by ${req.user.id}`)
  res.json({ ok: true })
})

export { logError }
export default router
