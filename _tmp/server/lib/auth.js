import { supabaseAdmin, supabaseAnon } from './clients.js'

export const STAFF_ROLES = ['admin', 'admin_2', 'hired_dev', 'moderator']
export const PLATFORM_ROLES = ['contractor', 'project_owner', 'agent', 'homeowner']
export const ALL_INVITE_ROLES = [...STAFF_ROLES, ...PLATFORM_ROLES]

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data, error } = await supabaseAnon.auth.getUser(token)
  if (error || !data?.user) return res.status(401).json({ error: 'Unauthorized' })
  req.user = data.user
  next()
}

export async function requireSuperAdmin(req, res, next) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', req.user.id)
    .single()
  if (u?.account_type !== 'admin') return res.status(403).json({ error: 'Super admin only' })
  next()
}

export async function requireAdminLevel(req, res, next) {
  const { data: u } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', req.user.id)
    .single()
  if (!['admin', 'admin_2'].includes(u?.account_type))
    return res.status(403).json({ error: 'Admin access required' })
  req.adminUser = u
  next()
}
