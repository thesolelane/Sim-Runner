import express from 'express'
import {
  stripe,
  supabaseAdmin,
  STRIPE_WEBHOOK_SECRET,
  BUNDLES,
  APP_ORIGIN,
} from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = express.Router()

async function handleSmsSubscriptionActivated(session, userId, smsTier) {
  if (!userId || !smsTier) {
    console.error('[sms-webhook] Missing userId or smsTier in session metadata')
    return
  }
  const stripeSubscriptionId = session.subscription
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      sms_tier: smsTier,
      sms_alerts_enabled: true,
      stripe_sms_sub_id: stripeSubscriptionId,
    })
    .eq('id', userId)
  if (error) {
    console.error('[sms-webhook] Failed to activate SMS tier:', error.message)
  } else {
    console.log(`[sms-webhook] Activated ${smsTier} SMS tier for user ${userId}`)
  }
}

async function handleSmsSubscriptionCancelled(sub) {
  const subId = sub.id
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      sms_tier: null,
      sms_alerts_enabled: true,
      phone_verified: false,
      phone_number: null,
      sms_count_this_period: 0,
      stripe_sms_sub_id: null,
    })
    .eq('stripe_sms_sub_id', subId)
  if (error) {
    console.error('[sms-webhook] Failed to deactivate SMS subscription:', error.message)
  } else {
    console.log(`[sms-webhook] Deactivated SMS for subscription ${subId}`)
  }
}

router.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature']
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { userId, credits, bundleId, smsTier } = session.metadata ?? {}

    if (smsTier) {
      await handleSmsSubscriptionActivated(session, userId, smsTier)
    } else {
      if (!userId || !credits) {
        console.error('[webhook] Missing metadata on session:', session.id)
        return res.status(400).json({ error: 'Missing metadata' })
      }
      const creditsNum = parseInt(credits, 10)
      const bundle = BUNDLES.find(b => b.id === bundleId)
      const { data: shouldCredit, error: fulfillErr } = await supabaseAdmin.rpc(
        'fulfill_stripe_purchase',
        {
          p_stripe_session_id: session.id,
          p_user_id: userId,
          p_credits: creditsNum,
          p_amount_cents: bundle?.cents ?? 0,
          p_bundle_id: bundleId ?? '',
        }
      )
      if (fulfillErr) {
        console.error('[webhook] fulfill_stripe_purchase error:', fulfillErr.message)
        return res.status(500).json({ error: 'DB error' })
      }
      if (shouldCredit) {
        console.log(`[webhook] Fulfilled ${creditsNum} credits for user ${userId}`)
      } else {
        console.log(`[webhook] Session ${session.id} already processed`)
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    await handleSmsSubscriptionCancelled(event.data.object)
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object
    const { userId } = sub.metadata ?? {}
    if (userId) {
      if (sub.status === 'active') {
        await supabaseAdmin
          .from('users')
          .update({ sms_count_this_period: 0 })
          .eq('id', userId)
          .eq('stripe_sms_sub_id', sub.id)
        console.log(`[webhook] Reset SMS count for user ${userId} on renewal`)
      } else if (['past_due', 'unpaid', 'canceled', 'incomplete_expired'].includes(sub.status)) {
        await supabaseAdmin
          .from('users')
          .update({ sms_alerts_enabled: false })
          .eq('id', userId)
          .eq('stripe_sms_sub_id', sub.id)
        console.log(
          `[webhook] Disabled SMS alerts for user ${userId} — subscription status: ${sub.status}`
        )
      }
    }
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object
    const subId = invoice.subscription
    if (subId && invoice.billing_reason === 'subscription_cycle') {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('stripe_sms_sub_id', subId)
      if (users && users.length > 0) {
        await supabaseAdmin
          .from('users')
          .update({ sms_count_this_period: 0 })
          .eq('stripe_sms_sub_id', subId)
        console.log(`[webhook] Reset SMS count on invoice payment for subscription ${subId}`)
      }
    }
  }

  res.json({ received: true })
})

router.post('/api/create-checkout-session', requireAuth, async (req, res) => {
  const { bundleId } = req.body ?? {}
  const userId = req.user.id
  const bundle = BUNDLES.find(b => b.id === bundleId)

  if (!bundle) return res.status(400).json({ error: 'Invalid bundle' })

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()
  if (userRow?.account_type === 'contractor' || userRow?.account_type === 'admin') {
    return res.status(403).json({ error: 'This account type does not use credits' })
  }

  const rawEmail = req.user.email ?? ''
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: emailValid ? rawEmail : undefined,
      line_items: [{ price: bundle.priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${APP_ORIGIN}/settings?tab=billing&success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_ORIGIN}/settings?tab=billing&canceled=true`,
      metadata: {
        userId,
        credits: String(bundle.credits),
        bundleId: bundle.id,
        priceId: bundle.priceId,
      },
    })

    const { error: purchaseErr } = await supabaseAdmin.from('purchases').insert({
      user_id: userId,
      stripe_session_id: session.id,
      credits: bundle.credits,
      amount_cents: bundle.cents,
      status: 'pending',
    })
    if (purchaseErr) console.error('[checkout] Purchase pre-insert failed:', purchaseErr.message)

    res.json({ url: session.url })
  } catch (err) {
    console.error('[checkout] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

router.get('/api/session-status', requireAuth, async (req, res) => {
  const sessionId = req.query.session_id
  const userId = req.user.id
  if (!sessionId) return res.status(400).json({ error: 'Missing session_id' })

  const { data: purchase } = await supabaseAdmin
    .from('purchases')
    .select('status, credits')
    .eq('stripe_session_id', sessionId)
    .eq('user_id', userId)
    .single()

  if (!purchase) return res.status(404).json({ error: 'Session not found' })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('credit_balance')
    .eq('id', userId)
    .single()

  res.json({ status: purchase.status, credit_balance: user?.credit_balance ?? 0 })
})

export default router
