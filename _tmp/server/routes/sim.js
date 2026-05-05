import { Router } from 'express'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESULTS_FILE = path.join(__dirname, '../../.local/sim_results.json')
const SCRIPT_PATH  = path.join(__dirname, '../../scripts/simulate.mjs')
const MAX_RUNS     = 20

let running = false

// ── Helpers ────────────────────────────────────────────────────────────────

function loadResults() {
  try {
    if (!fs.existsSync(RESULTS_FILE)) return []
    return JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'))
  } catch { return [] }
}

function saveResults(runs) {
  try {
    fs.mkdirSync(path.dirname(RESULTS_FILE), { recursive: true })
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(runs.slice(0, MAX_RUNS), null, 2), 'utf8')
  } catch {}
}

function checkSecret(req, res) {
  const secret = process.env.SIM_WEBHOOK_SECRET
  if (!secret) {
    res.status(503).json({ error: 'SIM_WEBHOOK_SECRET not configured on server' })
    return false
  }
  const provided = req.query.secret ?? req.headers['x-sim-secret']
  if (provided !== secret) {
    res.status(401).json({ error: 'Invalid secret' })
    return false
  }
  return true
}

// ── POST /api/internal/run-sim ─────────────────────────────────────────────
// Coolify hits this URL after every successful deploy.
// Returns 202 immediately; sim runs in background.

router.post('/api/internal/run-sim', (req, res) => {
  if (!checkSecret(req, res)) return

  if (running) {
    return res.status(409).json({ error: 'Simulation already running' })
  }

  const run = {
    id:           `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    triggered_by: req.query.source ?? req.headers['x-coolify-event'] ?? 'webhook',
    started_at:   new Date().toISOString(),
    finished_at:  null,
    duration_ms:  null,
    pass:         null,
    fail:         null,
    total:        null,
    status:       'running',
    output:       '',
  }

  const runs = loadResults()
  runs.unshift(run)
  saveResults(runs)

  running = true
  res.status(202).json({ ok: true, run_id: run.id, message: 'Simulation started' })

  const start = Date.now()
  const child = spawn('node', [SCRIPT_PATH], {
    env: {
      ...process.env,
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
      SIM_SB_URL:          process.env.BETA_SUPABASE_URL  ?? process.env.VITE_SUPABASE_URL ?? '',
      SIM_SB_ANON_KEY:     process.env.BETA_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '',
      SIM_SB_SERVICE_KEY:  process.env.BETA_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      SIM_APP_URL:         process.env.BETA_APP_URL ?? 'https://dev.traydbook.com',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', chunk => { output += chunk.toString() })
  child.stderr.on('data', chunk => { output += '[stderr] ' + chunk.toString() })

  child.on('close', code => {
    running = false
    const duration = Date.now() - start

    const passMatch = output.match(/✅ Passed:\s*(\d+)/)
    const failMatch = output.match(/❌ Failed:\s*(\d+)/)
    const pass = passMatch ? parseInt(passMatch[1]) : null
    const fail = failMatch ? parseInt(failMatch[1]) : null

    run.finished_at = new Date().toISOString()
    run.duration_ms = duration
    run.pass        = pass
    run.fail        = fail
    run.total       = pass != null && fail != null ? pass + fail : null
    run.status      = code === 0 && fail === 0 ? 'pass' : 'fail'
    run.output      = output

    const fresh = loadResults()
    const idx   = fresh.findIndex(r => r.id === run.id)
    if (idx !== -1) fresh[idx] = run
    else fresh.unshift(run)
    saveResults(fresh)

    const icon = run.status === 'pass' ? '✅' : '❌'
    console.log(
      `[sim] ${icon} Run ${run.id} — ${run.pass}/${run.total} passed — ${(duration / 1000).toFixed(1)}s`
    )
  })
})

// ── GET /api/internal/sim-results ─────────────────────────────────────────
// Returns the last N simulation runs.

router.get('/api/internal/sim-results', (req, res) => {
  if (!checkSecret(req, res)) return
  const limit = Math.min(parseInt(req.query.limit ?? '10'), MAX_RUNS)
  const runs  = loadResults().slice(0, limit)
  res.json({ running, runs })
})

export default router
