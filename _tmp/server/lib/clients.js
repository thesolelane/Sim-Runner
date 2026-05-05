import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import Telnyx from 'telnyx'

const isBeta = process.env.SUPABASE_ENV === 'beta'

export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? ''
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

export const SUPABASE_URL = isBeta
  ? (process.env.BETA_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '')
  : (process.env.VITE_SUPABASE_URL ?? '')

export const SUPABASE_SERVICE_ROLE_KEY = isBeta
  ? (process.env.BETA_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')
  : (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '')

export const SUPABASE_ANON_KEY = isBeta
  ? (process.env.BETA_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '')
  : (process.env.VITE_SUPABASE_ANON_KEY ?? '')

if (isBeta) console.log('[server] ⚡ Running against BETA Supabase project')
export const TELNYX_API_KEY = process.env.TELNYX_API_KEY ?? ''
export const TELNYX_PHONE_NUMBER = process.env.TELNYX_PHONE_NUMBER ?? ''
export const SMS_STARTER_PRICE_ID = process.env.SMS_STARTER_PRICE_ID ?? ''
export const SMS_UNLIMITED_PRICE_ID = process.env.SMS_UNLIMITED_PRICE_ID ?? ''

export const APP_ORIGIN =
  process.env.APP_ORIGIN ??
  (process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : 'http://localhost:5000')

if (!STRIPE_SECRET_KEY) console.warn('[server] STRIPE_SECRET_KEY not set')
if (!STRIPE_WEBHOOK_SECRET) console.warn('[server] STRIPE_WEBHOOK_SECRET not set')
if (!SUPABASE_SERVICE_ROLE_KEY) console.warn('[server] SUPABASE_SERVICE_ROLE_KEY not set')
if (!SUPABASE_ANON_KEY) console.warn('[server] VITE_SUPABASE_ANON_KEY not set')
if (!TELNYX_API_KEY) console.warn('[server] TELNYX_API_KEY not set — SMS disabled')
if (!TELNYX_PHONE_NUMBER) console.warn('[server] TELNYX_PHONE_NUMBER not set — SMS disabled')
if (!SMS_STARTER_PRICE_ID) console.warn('[server] SMS_STARTER_PRICE_ID not set')
if (!SMS_UNLIMITED_PRICE_ID) console.warn('[server] SMS_UNLIMITED_PRICE_ID not set')

export const stripe = new Stripe(STRIPE_SECRET_KEY)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export let telnyxClient = null
if (TELNYX_API_KEY) {
  telnyxClient = new Telnyx(TELNYX_API_KEY)
}

export const BUNDLES = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 25,
    cents: 900,
    priceId: 'price_1TEMD8CXFkuyP9oE1vVyWb2D',
    productId: 'prod_UClkf2uXvDLFsN',
  },
  {
    id: 'builder',
    name: 'Builder',
    credits: 75,
    cents: 2400,
    priceId: 'price_1TEMD9CXFkuyP9oEEtINcbiN',
    productId: 'prod_UClkweiFvm2VPM',
  },
  {
    id: 'professional',
    name: 'Professional',
    credits: 200,
    cents: 5400,
    priceId: 'price_1TEMD9CXFkuyP9oEJKb5PKGL',
    productId: 'prod_UClkuhQHCsalUv',
  },
  {
    id: 'power',
    name: 'Power',
    credits: 500,
    cents: 9900,
    priceId: 'price_1TEMDACXFkuyP9oEJxlOr18m',
    productId: 'prod_UClksIMbwsf3xh',
  },
]

export const SMS_PLANS = {
  starter: { priceId: SMS_STARTER_PRICE_ID, tier: 'starter', cap: 150 },
  unlimited: { priceId: SMS_UNLIMITED_PRICE_ID, tier: 'unlimited', cap: null },
}
