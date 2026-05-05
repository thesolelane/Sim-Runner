import { Router } from 'express'
import crypto from 'crypto'
import { supabaseAdmin, APP_ORIGIN } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

router.post('/api/team/invite', requireAuth, async (req, res) => {
  const { inviteEmail, role, responsibilityAccepted } = req.body ?? {}
  const principalId = req.user.id

  if (!inviteEmail || !role || !responsibilityAccepted) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  if (!['admin', 'contributor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  const { data: principalRow, error: principalErr } = await supabaseAdmin
    .from('users')
    .select('display_name, is_delegate')
    .eq('id', principalId)
    .single()

  if (principalErr || !principalRow) return res.status(404).json({ error: 'User not found' })
  if (principalRow.is_delegate)
    return res.status(403).json({ error: 'Delegates cannot invite other delegates' })

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: delegation, error: delegationErr } = await supabaseAdmin
    .from('account_delegations')
    .insert({
      principal_id: principalId,
      delegate_id: null,
      role,
      invite_email: inviteEmail,
      invite_token: token,
      invite_expires_at: expiresAt,
      status: 'pending',
      responsibility_accepted_at: new Date().toISOString(),
      responsibility_terms_version: '1.0',
    })
    .select('id')
    .single()

  if (delegationErr) {
    console.error('[team/invite] DB error:', delegationErr.message)
    return res.status(500).json({ error: 'Failed to create invitation' })
  }

  const joinUrl = `${APP_ORIGIN}/join/${token}`
  const roleLabel = role === 'admin' ? 'Team Admin' : 'Contributor'
  console.log(
    `[team/invite] Invite created for ${inviteEmail} (${roleLabel}) by ${principalId}. Join URL: ${joinUrl}`
  )

  res.json({
    success: true,
    delegationId: delegation.id,
    joinUrl,
    message: `Invite created for ${inviteEmail}. Share this link: ${joinUrl}`,
  })
})

router.post('/api/team/revoke', requireAuth, async (req, res) => {
  const { delegationId } = req.body ?? {}
  const principalId = req.user.id

  if (!delegationId) return res.status(400).json({ error: 'Missing delegationId' })

  const { data: delegation, error: fetchErr } = await supabaseAdmin
    .from('account_delegations')
    .select('id, principal_id, delegate_id, status')
    .eq('id', delegationId)
    .single()

  if (fetchErr || !delegation) return res.status(404).json({ error: 'Delegation not found' })
  if (delegation.principal_id !== principalId) return res.status(403).json({ error: 'Forbidden' })
  if (delegation.status === 'revoked') return res.status(400).json({ error: 'Already revoked' })

  const { error: updateErr } = await supabaseAdmin
    .from('account_delegations')
    .update({ status: 'revoked' })
    .eq('id', delegationId)

  if (updateErr) {
    console.error('[team/revoke] DB error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to revoke delegation' })
  }

  if (delegation.delegate_id) {
    await supabaseAdmin
      .from('users')
      .update({ is_delegate: false, delegate_principal_id: null })
      .eq('id', delegation.delegate_id)
  }

  res.json({ success: true })
})

router.get('/api/team', requireAuth, async (req, res) => {
  const principalId = req.user.id

  const { data: delegations, error: dlgErr } = await supabaseAdmin
    .from('account_delegations')
    .select('id, role, invite_email, status, responsibility_accepted_at, created_at, delegate_id')
    .eq('principal_id', principalId)
    .order('created_at', { ascending: false })

  if (dlgErr) return res.status(500).json({ error: 'Failed to fetch team' })

  const delegateIds = delegations.filter(d => d.delegate_id).map(d => d.delegate_id)
  let delegateProfiles = []
  if (delegateIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('users')
      .select('id, display_name, avatar_url, created_at')
      .in('id', delegateIds)
    delegateProfiles = profiles ?? []
  }

  const enriched = delegations.map(d => ({
    ...d,
    delegate_profile: delegateProfiles.find(p => p.id === d.delegate_id) ?? null,
  }))

  const activeDelegationIds = delegations.filter(d => d.status === 'active').map(d => d.id)
  let auditLog = []
  if (activeDelegationIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from('delegate_audit_log')
      .select('id, delegation_id, actual_user_id, action_type, action_detail, created_at')
      .in('delegation_id', activeDelegationIds)
      .order('created_at', { ascending: false })
      .limit(50)
    auditLog = logs ?? []
  }

  res.json({ delegations: enriched, auditLog })
})

export default router
