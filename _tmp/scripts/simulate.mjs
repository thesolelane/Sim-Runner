#!/usr/bin/env node
// TraydBook End-to-End Simulation — v3
//
// Manual run (on Coolify host):
//   NODE_TLS_REJECT_UNAUTHORIZED=0 node /tmp/sim.mjs
//
// Env vars override hardcoded defaults — set these when running via webhook:
//   SIM_SB_URL          Supabase project URL
//   SIM_SB_ANON_KEY     Supabase anon key
//   SIM_SB_SERVICE_KEY  Supabase service role key
//   SIM_APP_URL         App base URL  (default: https://dev.traydbook.com)
//
// Covers: health · auth guards · create/signin/onboard 10 users ·
//         image upload · posts · comments · likes · fund owners ·
//         RFQs · bids · bid award · wallet access · cleanup

const SB  = process.env.SIM_SB_URL         || ''
const AK  = process.env.SIM_SB_ANON_KEY    || ''
const SK  = process.env.SIM_SB_SERVICE_KEY || ''
const APP = process.env.SIM_APP_URL        || 'https://dev.traydbook.com'

if (!SB || !AK || !SK) {
  console.error('[sim] Missing required env vars: SIM_SB_URL, SIM_SB_ANON_KEY, SIM_SB_SERVICE_KEY')
  console.error('[sim] Set these before running. On the Coolify server they are injected automatically.')
  process.exit(1)
}
const TS  = Date.now()
const PW  = 'TraydSim2026'

// Minimal 1×1 transparent GIF (35 bytes) used for image upload tests
const GIF1x1 = Buffer.from('R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==', 'base64')

const USERS = [
  { i:1,  type:'contractor',    trade:'Electrician', name:'Alex Sparks'    },
  { i:2,  type:'contractor',    trade:'Plumber',     name:'Jordan Pipes'   },
  { i:3,  type:'contractor',    trade:'HVAC Tech',   name:'Sam Coldair'    },
  { i:4,  type:'contractor',    trade:'Carpenter',   name:'Casey Frame'    },
  { i:5,  type:'contractor',    trade:'Painter',     name:'Riley Brush'    },
  { i:6,  type:'project_owner', trade:null,          name:'Morgan Build'   },
  { i:7,  type:'project_owner', trade:null,          name:'Taylor Develop' },
  { i:8,  type:'project_owner', trade:null,          name:'Drew Construct' },
  { i:9,  type:'project_owner', trade:null,          name:'Quinn Projects' },
  { i:10, type:'project_owner', trade:null,          name:'Blake Estate'   },
]

let pass = 0, fail = 0
const ok  = (m, d='') => { console.log(`  ✅ ${m}${d ? ' — ' + d : ''}`); pass++ }
const no  = (m, d='') => { console.log(`  ❌ ${m}${d ? ' — ' + d : ''}`); fail++ }
const sep = (t)        =>   console.log(`\n── ${t} ──`)

// ── HTTP helpers ──────────────────────────────────────────────

async function req(method, url, body, token, admin) {
  const h = { 'Content-Type': 'application/json' }
  if (admin)      { h['Authorization'] = `Bearer ${SK}`; h['apikey'] = SK }
  else if (token)   h['Authorization'] = `Bearer ${token}`
  else              h['apikey'] = AK
  const opts = { method, headers: h }
  if (body && method !== 'GET' && method !== 'DELETE') opts.body = JSON.stringify(body)
  const r = await fetch(url, opts)
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// Call a Supabase RPC with a user JWT
async function rpc(fn, args, token) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': AK,
    'Authorization': `Bearer ${token}`,
  }
  const r = await fetch(`${SB}/rest/v1/rpc/${fn}`, { method:'POST', headers:h, body:JSON.stringify(args) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// Insert a row into a Supabase table as an authenticated user
async function sbInsert(table, row, token) {
  const h = {
    'Content-Type': 'application/json',
    'apikey': AK,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'return=representation',
  }
  const r = await fetch(`${SB}/rest/v1/${table}`, { method:'POST', headers:h, body:JSON.stringify(row) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// Patch rows in a Supabase table using service role (admin)
async function sbAdminPatch(table, match, update) {
  const qs = Object.entries(match).map(([k,v]) => `${k}=eq.${v}`).join('&')
  const h = {
    'Content-Type': 'application/json',
    'apikey': SK,
    'Authorization': `Bearer ${SK}`,
    'Prefer': 'return=representation',
  }
  const r = await fetch(`${SB}/rest/v1/${table}?${qs}`, { method:'PATCH', headers:h, body:JSON.stringify(update) })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// Upload a 1×1 GIF via the Express multipart endpoint
async function uploadImage(token) {
  const form = new FormData()
  form.append('files', new Blob([GIF1x1], { type: 'image/gif' }), 'sim-test.gif')
  const r = await fetch(`${APP}/api/upload/post-media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  })
  try { return { s: r.status, b: await r.json() } } catch { return { s: r.status, b: {} } }
}

// ── Main simulation ───────────────────────────────────────────

console.log(`\n${'═'.repeat(52)}\n  TraydBook Enhanced Simulation v2\n${'═'.repeat(52)}`)

// 1. Health
sep('Health')
const hc = await req('GET', `${APP}/healthz`)
hc.b?.ok ? ok('Health check', 'ok:true') : no('Health check', hc.s)

// 2. Auth guards (including new routes)
sep('Auth Guards')
for (const [m, p, b] of [
  ['GET',  '/api/wallet/status',       null],
  ['POST', '/api/team/invite',         {}  ],
  ['POST', '/api/onboarding/complete', {}  ],
  ['POST', '/api/posts',               {}  ],
  ['POST', '/api/upload/post-media',   null],
]) {
  const r = await req(m, `${APP}${p}`, b)
  r.s === 401
    ? ok(`Guard ${m} ${p}`, '401')
    : no(`Guard ${m} ${p}`, `got ${r.s}`)
}

// 3. Create 10 users
sep('Create 10 Users')
for (const u of USERS) {
  u.email = `sim_${u.type}_${u.i}_${TS}@traydbook.com`
  const r = await req('POST', `${SB}/auth/v1/admin/users`,
    { email: u.email, password: PW, email_confirm: true }, null, true)
  if (r.s === 200 && r.b.id) {
    u.id = r.b.id
    ok(`Create #${u.i} ${u.name}`, u.id.slice(0,8) + '...')
  } else {
    no(`Create #${u.i} ${u.name}`, r.b?.message || r.s)
  }
}

// 4. Sign in all
sep('Sign In All')
for (const u of USERS) {
  if (!u.id) continue
  const r = await req('POST', `${SB}/auth/v1/token?grant_type=password`, { email: u.email, password: PW })
  if (r.b?.access_token) {
    u.token = r.b.access_token
    ok(`Sign in #${u.i} ${u.name}`)
  } else {
    no(`Sign in #${u.i} ${u.name}`, r.b?.error_description || r.s)
  }
}

// 5. Onboard all
sep('Onboarding')
for (const u of USERS) {
  if (!u.token) continue
  const body = { display_name: u.name, account_type: u.type }
  if (u.trade) body.trade = u.trade
  const r = await req('POST', `${APP}/api/onboarding/complete`, body, u.token)
  r.s === 200 || r.s === 409
    ? ok(`Onboard #${u.i} ${u.type}`)
    : no(`Onboard #${u.i} ${u.type}`, JSON.stringify(r.b).slice(0,80))
}

// 6. Image upload (contractors)
sep('Image Upload')
for (const u of USERS.filter(u => u.type === 'contractor')) {
  if (!u.token) continue
  const r = await uploadImage(u.token)
  if (r.s === 200 && Array.isArray(r.b.urls) && r.b.urls.length > 0) {
    u.imageUrl = r.b.urls[0]
    ok(`Upload #${u.i} ${u.name}`, 'got public URL')
  } else {
    no(`Upload #${u.i} ${u.name}`, r.b?.error || r.s)
  }
}

// 7. Posts (all 10 users — contractors with image, owners without)
sep('Posts')
const POST_TYPES = {
  contractor:    ['trade_tip', 'project_update', 'safety_alert'],
  project_owner: ['project_update', 'story'],
}
for (const u of USERS) {
  if (!u.token) continue
  const types    = POST_TYPES[u.type] ?? ['project_update']
  const postType = types[u.i % types.length]
  const body = {
    post_type: postType,
    body:      `[SIM] ${u.name} — ${postType} #${u.i} posted at ${new Date(TS).toISOString()}`,
    hashtags:  ['TraydBook', 'SimTest'],
    ...(u.imageUrl ? { media_urls: [u.imageUrl] } : {}),
  }
  const r = await req('POST', `${APP}/api/posts`, body, u.token)
  if (r.s === 200 && r.b?.post?.id) {
    u.postId = r.b.post.id
    ok(`Post #${u.i} ${u.name}`, `${postType}${u.imageUrl ? ' +image' : ''}`)
  } else {
    no(`Post #${u.i} ${u.name}`, JSON.stringify(r.b).slice(0,80))
  }
}

// 8. Comments (cross-role: owners on contractor posts, contractors on owner posts)
sep('Comments')
const contractors = USERS.filter(u => u.type === 'contractor'    && u.token && u.postId)
const owners      = USERS.filter(u => u.type === 'project_owner' && u.token && u.postId)

for (const owner of owners.slice(0,3)) {
  for (const contractor of contractors.slice(0,3)) {
    const r = await rpc('post_comment', {
      p_post_id: contractor.postId,
      p_body:    `[SIM] ${owner.name} → ${contractor.name}: great work!`,
    }, owner.token)
    typeof r.b === 'string' && r.b.length === 36
      ? ok(`Comment: ${owner.name} → ${contractor.name}`)
      : no(`Comment: ${owner.name} → ${contractor.name}`, JSON.stringify(r.b).slice(0,60))
  }
}

for (const contractor of contractors.slice(0,3)) {
  for (const owner of owners.slice(0,2)) {
    const r = await rpc('post_comment', {
      p_post_id: owner.postId,
      p_body:    `[SIM] ${contractor.name} → ${owner.name}: interested in this project!`,
    }, contractor.token)
    typeof r.b === 'string' && r.b.length === 36
      ? ok(`Comment: ${contractor.name} → ${owner.name}`)
      : no(`Comment: ${contractor.name} → ${owner.name}`, JSON.stringify(r.b).slice(0,60))
  }
}

// 9. Likes (each user likes the next user's post via RPC)
sep('Likes')
for (const u of USERS) {
  if (!u.token) continue
  const target = USERS[u.i % USERS.length]
  if (!target.postId) continue
  const r = await rpc('increment_post_like', { post_id: target.postId, delta: 1 }, u.token)
  r.s === 200 || r.s === 204
    ? ok(`Like: ${u.name} → ${target.name}'s post`)
    : no(`Like: ${u.name} → ${target.name}`, `${r.s} ${JSON.stringify(r.b).slice(0,40)}`)
}

// 10. Fund owners with 50 credits (RFQs cost 10 credits each for non-contractors)
sep('Fund Owners (50 credits)')
for (const u of owners) {
  const r = await sbAdminPatch('users', { id: u.id }, { credit_balance: 50 })
  const row = Array.isArray(r.b) ? r.b[0] : r.b
  row?.credit_balance === 50
    ? ok(`Fund ${u.name}`, '50 credits')
    : no(`Fund ${u.name}`, JSON.stringify(r.b).slice(0,60))
}

// 11. Owners post RFQs (costs 10 credits each, deducted by the RPC)
sep('Post RFQs')
const TRADES_FOR_RFQ = ['Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Painting']
const bidDeadline    = new Date(TS + 30 * 24 * 60 * 60 * 1000).toISOString()

for (const [idx, u] of owners.entries()) {
  if (!u.token) continue
  const trade = TRADES_FOR_RFQ[idx % TRADES_FOR_RFQ.length]
  const r = await rpc('post_rfq', {
    p_title:             `[SIM] ${u.name} — ${trade} Project`,
    p_trade_needed:      trade,
    p_project_type:      'renovation',
    p_scope_description: `Simulation RFQ posted by ${u.name}. Seeking ${trade} work for a 2,000 sqft commercial space.`,
    p_budget_min:        5000,
    p_budget_max:        15000,
    p_sq_footage:        2000,
    p_start_date:        null,
    p_duration_weeks:    4,
    p_bid_deadline:      bidDeadline,
    p_location_zip:      `9000${u.i}`,
    p_location_city:     'Los Angeles',
    p_location_state:    'CA',
    p_requirements:      ['Licensed', 'Insured'],
    p_share_to_feed:     false,
  }, u.token)
  if (r.s === 200 && typeof r.b === 'string') {
    u.rfqId = r.b
    ok(`RFQ #${u.i} ${u.name}`, `id: ${r.b.slice(0,8)}...`)
  } else {
    no(`RFQ #${u.i} ${u.name}`, JSON.stringify(r.b))
  }
}

// 12. All contractors bid on owner #6 (Morgan Build)'s RFQ
sep('Submit Bids')
const targetOwner = owners[0] // Morgan Build
if (targetOwner?.rfqId) {
  for (const [idx, contractor] of contractors.entries()) {
    if (!contractor.token) continue
    const amount = 7500 + idx * 500
    const r = await rpc('submit_bid', {
      p_rfq_id:         targetOwner.rfqId,
      p_amount:         amount,
      p_timeline_weeks: 3 + idx,
      p_cover_note:     `[SIM] ${contractor.name} — ${contractor.trade} at $${amount}`,
      p_document_url:   null,
    }, contractor.token)
    if (r.s === 200 && typeof r.b === 'string') {
      contractor.bidId = r.b
      ok(`Bid: ${contractor.name}`, `$${amount} — id: ${r.b.slice(0,8)}...`)
    } else {
      no(`Bid: ${contractor.name}`, JSON.stringify(r.b).slice(0,80))
    }
  }
} else {
  no('Bid phase skipped', 'owner #6 RFQ not created')
}

// 13. Owner #6 awards contractor #1's bid
sep('Award Bid')
const winner = contractors[0] // Alex Sparks
if (targetOwner?.rfqId && winner?.bidId) {
  const r = await rpc('award_bid', {
    p_bid_id: winner.bidId,
    p_rfq_id: targetOwner.rfqId,
  }, targetOwner.token)
  r.s === 200 || r.s === 204
    ? ok(`Award: ${targetOwner.name} → ${winner.name}`, 'bid awarded')
    : no(`Award: ${targetOwner.name} → ${winner.name}`, JSON.stringify(r.b).slice(0,80))
} else {
  no('Award phase skipped', 'missing rfqId or bidId')
}

// 14. Wallet access (role enforcement)
sep('Wallet Access')
for (const u of USERS) {
  if (!u.token) continue
  const r = await req('GET', `${APP}/api/wallet/status`, null, u.token)
  if (u.type === 'contractor' && r.s === 200) {
    ok(`Wallet #${u.i} contractor`, `pubkey: ${r.b.solana_pubkey || 'none'}`)
  } else if (u.type === 'project_owner' && (r.s === 403 || r.s === 404)) {
    ok(`Wallet #${u.i} owner blocked`, `${r.s} correct`)
  } else {
    no(`Wallet #${u.i}`, `expected ${u.type === 'contractor' ? 200 : '403/404'} got ${r.s}`)
  }
}

// 15. Cleanup — delete all sim auth users (cascades to all DB rows)
sep('Cleanup')
for (const u of USERS) {
  if (!u.id) continue
  const r = await req('DELETE', `${SB}/auth/v1/admin/users/${u.id}`, null, null, true)
  r.s === 200
    ? ok(`Delete #${u.i} ${u.name}`)
    : no(`Delete #${u.i}`, r.s)
}

// ── Summary ───────────────────────────────────────────────────
console.log(`\n${'═'.repeat(52)}`)
console.log(`  ✅ Passed: ${pass}`)
console.log(`  ❌ Failed: ${fail}`)
console.log(`  Total:    ${pass + fail}`)
console.log(`${'═'.repeat(52)}\n`)
