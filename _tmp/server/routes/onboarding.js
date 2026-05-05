import { Router } from 'express'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

const VALID_ACCOUNT_TYPES = ['contractor', 'project_owner', 'agent', 'homeowner']

function slugify(name) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20) || 'user'
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${base}${suffix}`
}

router.post('/api/onboarding/complete', requireAuth, async (req, res) => {
  const { display_name, account_type, location_city, location_state, trade } = req.body
  const userId = req.user.id

  if (!display_name?.trim()) {
    return res.status(400).json({ error: 'display_name is required' })
  }
  if (!VALID_ACCOUNT_TYPES.includes(account_type)) {
    return res.status(400).json({ error: 'Invalid account_type' })
  }

  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'Profile already exists' })
  }

  const handle = slugify(display_name.trim())

  const { error: userErr } = await supabaseAdmin.from('users').insert({
    id: userId,
    email: req.user.email,
    display_name: display_name.trim(),
    handle,
    account_type,
    location_city: location_city?.trim() || null,
    location_state: location_state || null,
    credit_balance: 0,
  })

  if (userErr) {
    console.error('[onboarding] users insert error:', userErr)
    return res.status(500).json({ error: userErr.message })
  }

  if (account_type === 'contractor') {
    const { error: cpErr } = await supabaseAdmin.from('contractor_profiles').insert({
      user_id: userId,
      primary_trade: trade || 'General Contractor',
    })
    if (cpErr) {
      console.error('[onboarding] contractor_profiles insert error:', cpErr)
      return res.status(500).json({ error: cpErr.message })
    }
  }

  res.json({ ok: true })
})

export default router
