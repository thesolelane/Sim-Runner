import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// ── One-time credit bundles ──────────────────────────────────────────────────
const BUNDLES = [
  {
    id:          'starter',
    name:        'TraydBook Starter Credits',
    description: '25 credits — post jobs, RFQs & message contractors on TraydBook',
    credits:     25,
    cents:       900,
  },
  {
    id:          'builder',
    name:        'TraydBook Builder Credits',
    description: '75 credits — post jobs, RFQs & message contractors on TraydBook',
    credits:     75,
    cents:       2400,
  },
  {
    id:          'professional',
    name:        'TraydBook Professional Credits',
    description: '200 credits — post jobs, RFQs & message contractors on TraydBook',
    credits:     200,
    cents:       5400,
  },
  {
    id:          'power',
    name:        'TraydBook Power Credits',
    description: '500 credits — post jobs, RFQs & message contractors on TraydBook',
    credits:     500,
    cents:       9900,
  },
]

// ── Monthly SMS subscriptions ────────────────────────────────────────────────
const SMS_PLANS = [
  {
    id:          'sms_alerts',
    name:        'TraydBook SMS Alerts',
    description: 'Get SMS notifications for new messages on TraydBook — $1.99/month',
    cents:       199,
    interval:    'month',
  },
]

async function seedBundles() {
  const results = {}

  for (const bundle of BUNDLES) {
    const existing = await stripe.products.search({
      query: `metadata['bundle_id']:'${bundle.id}'`,
    })

    let product
    if (existing.data.length > 0) {
      product = existing.data[0]
      console.log(`[skip] Bundle product exists: ${product.id} (${bundle.id})`)
    } else {
      product = await stripe.products.create({
        name:        bundle.name,
        description: bundle.description,
        metadata: {
          bundle_id: bundle.id,
          credits:   String(bundle.credits),
          type:      'credit_bundle',
        },
      })
      console.log(`[created] Bundle product: ${product.id} (${bundle.id})`)
    }

    const prices = await stripe.prices.list({ product: product.id, active: true })

    let price
    if (prices.data.length > 0) {
      price = prices.data[0]
      console.log(`[skip] Bundle price exists: ${price.id} ($${bundle.cents / 100})`)
    } else {
      price = await stripe.prices.create({
        product:     product.id,
        unit_amount: bundle.cents,
        currency:    'usd',
        metadata: {
          bundle_id: bundle.id,
          credits:   String(bundle.credits),
          type:      'credit_bundle',
        },
      })
      console.log(`[created] Bundle price: ${price.id} ($${bundle.cents / 100})`)
    }

    results[bundle.id] = {
      product_id: product.id,
      price_id:   price.id,
      credits:    bundle.credits,
      cents:      bundle.cents,
    }
  }

  return results
}

async function seedSmsPlans() {
  const results = {}

  for (const plan of SMS_PLANS) {
    const existing = await stripe.products.search({
      query: `metadata['plan_id']:'${plan.id}'`,
    })

    let product
    if (existing.data.length > 0) {
      product = existing.data[0]
      console.log(`[skip] SMS product exists: ${product.id} (${plan.id})`)
    } else {
      product = await stripe.products.create({
        name:        plan.name,
        description: plan.description,
        metadata: {
          plan_id: plan.id,
          type:    'sms_subscription',
        },
      })
      console.log(`[created] SMS product: ${product.id} (${plan.id})`)
    }

    const prices = await stripe.prices.list({ product: product.id, active: true })

    let price
    if (prices.data.length > 0) {
      price = prices.data[0]
      console.log(`[skip] SMS price exists: ${price.id} ($${plan.cents / 100}/mo)`)
    } else {
      price = await stripe.prices.create({
        product:     product.id,
        unit_amount: plan.cents,
        currency:    'usd',
        recurring: { interval: plan.interval },
        metadata: {
          plan_id: plan.id,
          type:    'sms_subscription',
        },
      })
      console.log(`[created] SMS price: ${price.id} ($${plan.cents / 100}/${plan.interval})`)
    }

    results[plan.id] = {
      product_id: product.id,
      price_id:   price.id,
      cents:      plan.cents,
      interval:   plan.interval,
    }
  }

  return results
}

async function seed() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY is not set')
    process.exit(1)
  }

  console.log('\n── Credit Bundles ──────────────────────────────────────')
  const bundleResults = await seedBundles()

  console.log('\n── SMS Subscriptions ───────────────────────────────────')
  const smsResults = await seedSmsPlans()

  console.log('\n=== FULL PRICE MAP ===')
  console.log(JSON.stringify({ bundles: bundleResults, sms: smsResults }, null, 2))
}

seed().catch(err => {
  console.error(err.message)
  process.exit(1)
})
