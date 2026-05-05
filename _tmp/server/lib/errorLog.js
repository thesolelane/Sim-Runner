import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_FILE = path.join(__dirname, '../../.local/error_log.jsonl')
const MAX_MEMORY = 500

const memoryLog = []

function ensureLogDir() {
  const dir = path.dirname(LOG_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export function logError({ context, message, detail, stack, userId, route, method, statusCode }) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    context: context ?? 'server',
    message: message ?? 'Unknown error',
    detail: detail ?? null,
    stack: stack ?? null,
    userId: userId ?? null,
    route: route ?? null,
    method: method ?? null,
    statusCode: statusCode ?? null,
  }

  memoryLog.unshift(entry)
  if (memoryLog.length > MAX_MEMORY) memoryLog.pop()

  try {
    ensureLogDir()
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8')
  } catch (_) {}

  return entry
}

export function getErrorLog({ limit = 100, offset = 0, context } = {}) {
  let items = memoryLog
  if (context) items = items.filter(e => e.context === context)
  return {
    total: items.length,
    items: items.slice(offset, offset + limit),
  }
}

export function clearErrorLog() {
  memoryLog.length = 0
  try {
    ensureLogDir()
    fs.writeFileSync(LOG_FILE, '', 'utf8')
  } catch (_) {}
}

export function loadLogFromDisk() {
  try {
    ensureLogDir()
    if (!fs.existsSync(LOG_FILE)) return
    const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean)
    const entries = lines
      .map(l => {
        try {
          return JSON.parse(l)
        } catch {
          return null
        }
      })
      .filter(Boolean)
    entries.reverse().forEach(e => {
      if (memoryLog.length < MAX_MEMORY) memoryLog.push(e)
    })
  } catch (_) {}
}
