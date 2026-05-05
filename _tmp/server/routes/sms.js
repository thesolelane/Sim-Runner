import { Router } from 'express'
import crypto from 'crypto'
import {
  stripe,
  supabaseAdmin,
  telnyxClient,
  TELNYX_PHONE_NUMBER,
  SMS_PLANS,
  APP_ORIGIN,
} from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

export async function sendSmsAlert(recipientId, senderName, threadId) {
  if (!telnyxClient || !TELNYX_PHONE_NUMBER) return

  try {
    const { data: recipient } = await supabaseAdmin
      .from('users')
      .select('sms_tier, sms_alerts_enabled, phone_verified, phone_number, sms_count_this_period')
      .eq('id', recipientId)
      .single()

    if (!recipient) return
    if (!recipient.sms_tier) return
    if (!recipient.sms_alerts_enabled) return
    if (!recipient.phone_verified) return
    if (!recipient.phone_number) return

    if (recipient.sms_tier === 'starter') {
      if (recipient.sms_count_this_period >= 150) {
        console.log(`[sms-dispatch] Starter cap reached for user ${recipientId}, skipping SMS`)
        return
      }
      const { error: incrErr } = await supabaseAdmin
        .from('users')
        .update({ sms_count_this_period: recipient.sms_count_this_period + 1 })
        .eq('id', recipientId)
        .eq('sms_count_this_period', recipient.sms_count_this_period)
      if (incrErr) {
        console.error('[sms-dispatch] Failed to increment SMS count:', incrErr.message)
        return
      }
    }

    const appUrl = APP_ORIGIN + '/messages/' + threadId
    await telnyxClient.messages.create({
      from: TELNYX_PHONE_NUMBER,
      to: recipient.phone_number,
      text: `New message from ${senderName} on TraydBook. Open the app to reply: ${appUrl}`,
    })
    console.log(`[sms-dispatch] Sent SMS alert to user ${recipientId}`)
  } catch (err) {
    console.error('[sms-dispatch] Telnyx error (non-blocking):', err.message)
  }
}

router.post('/api/sms/create-subscription', requireAuth, async (req, res) => {
  const { plan } = req.body ?? {}
  const userId = req.user.id

  const smsPlan = SMS_PLANS[plan]
  if (!smsPlan) return res.status(400).json({ error: 'Invalid SMS plan' })
  if (!smsPlan.priceId) return res.status(503).json({ error: 'SMS plan not configured' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type, sms_tier, stripe_sms_sub_id')
    .eq('id', userId)
    .single()

  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor')
    return res.status(403).json({ error: 'SMS alerts are only available for contractors' })
  if (userRow.sms_tier) return res.status(400).json({ error: 'Already subscribed to an SMS plan' })

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: req.user.email,
      line_items: [{ price: smsPlan.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${APP_ORIGIN}/settings?tab=notifications&sms_success=true`,
      cancel_url: `${APP_ORIGIN}/settings?tab=notifications&sms_canceled=true`,
      metadata: { userId, smsTier: smsPlan.tier },
      subscription_data: { metadata: { userId, smsTier: smsPlan.tier } },
    })
    res.json({ url: session.url })
  } catch (err) {
    console.error('[sms-checkout] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/api/sms/cancel-subscription', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('stripe_sms_sub_id, sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.stripe_sms_sub_id)
    return res.status(400).json({ error: 'No active SMS subscription' })

  try {
    await stripe.subscriptions.cancel(userRow.stripe_sms_sub_id)
    res.json({ cancelled: true })
  } catch (err) {
    console.error('[sms-cancel] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.post('/api/sms/toggle-alerts', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { enabled } = req.body ?? {}
  if (typeof enabled !== 'boolean')
    return res.status(400).json({ error: 'enabled must be a boolean' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_tier')
    .eq('id', userId)
    .single()
  if (!userRow?.sms_tier) return res.status(400).json({ error: 'No active SMS subscription' })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ sms_alerts_enabled: enabled })
    .eq('id', userId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ sms_alerts_enabled: enabled })
})

router.post('/api/sms/send-verification', requireAuth, async (req, res) => {
  const userId = req.user.id
  let { phone } = req.body ?? {}

  if (!phone) return res.status(400).json({ error: 'Phone number is required' })

  phone = phone.replace(/\D/g, '')
  if (phone.length === 10) phone = '1' + phone
  if (!/^1\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid US phone number' })
  phone = '+' + phone

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_tier')
    .eq('id', userId)
    .single()
  if (!userRow?.sms_tier) return res.status(403).json({ error: 'SMS subscription required' })
  if (!telnyxClient || !TELNYX_PHONE_NUMBER)
    return res.status(503).json({ error: 'SMS service not configured' })

  const otp = String(Math.floor(100000 + Math.random() * 900000))
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex')
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

  const { error: updateErr } = await supabaseAdmin
    .from('users')
    .update({
      phone_number: phone,
      phone_verified: false,
      sms_otp_hash: otpHash,
      sms_otp_expires_at: expiresAt,
    })
    .eq('id', userId)

  if (updateErr) {
    console.error('[sms-verify] DB update error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to save phone number' })
  }

  try {
    await telnyxClient.messages.create({
      from: TELNYX_PHONE_NUMBER,
      to: phone,
      text: `Your TraydBook verification code is: ${otp}. Valid for 10 minutes.`,
    })
    res.json({ sent: true })
  } catch (err) {
    console.error('[sms-verify] Telnyx error:', err.message)
    res.status(500).json({ error: 'Failed to send verification SMS' })
  }
})

router.post('/api/sms/verify', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { otp } = req.body ?? {}

  if (!otp || typeof otp !== 'string') return res.status(400).json({ error: 'OTP is required' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('sms_otp_hash, sms_otp_expires_at, sms_tier')
    .eq('id', userId)
    .single()

  if (!userRow?.sms_tier) return res.status(403).json({ error: 'SMS subscription required' })
  if (!userRow.sms_otp_hash) return res.status(400).json({ error: 'No pending verification' })

  if (new Date(userRow.sms_otp_expires_at) < new Date()) {
    return res.status(400).json({ error: 'Verification code expired. Please request a new one.' })
  }

  const inputHash = crypto.createHash('sha256').update(otp.trim()).digest('hex')
  if (inputHash !== userRow.sms_otp_hash)
    return res.status(400).json({ error: 'Invalid verification code' })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ phone_verified: true, sms_otp_hash: null, sms_otp_expires_at: null })
    .eq('id', userId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ verified: true })
})

router.get('/api/sms/status', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select(
      'sms_tier, sms_alerts_enabled, phone_verified, phone_number, sms_count_this_period, stripe_sms_sub_id'
    )
    .eq('id', userId)
    .single()

  if (error) return res.status(500).json({ error: error.message })

  let maskedPhone = null
  if (userRow?.phone_number && userRow.phone_verified) {
    const digits = userRow.phone_number.replace(/\D/g, '')
    maskedPhone = '(•••) •••-' + digits.slice(-4)
  }

  res.json({
    sms_tier: userRow?.sms_tier ?? null,
    sms_alerts_enabled: userRow?.sms_alerts_enabled ?? true,
    phone_verified: userRow?.phone_verified ?? false,
    sms_count_this_period: userRow?.sms_count_this_period ?? 0,
    has_subscription: !!userRow?.stripe_sms_sub_id,
    masked_phone: maskedPhone,
  })
})

export default router
