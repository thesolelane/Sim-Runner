import { Router } from 'express'
import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js'
import { supabaseAdmin } from '../lib/clients.js'
import { requireAuth } from '../lib/auth.js'

const router = Router()

const BASE58_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

router.post('/api/wallet/save-pubkey', requireAuth, async (req, res) => {
  const userId = req.user.id
  const { pubkey } = req.body ?? {}

  if (!pubkey || typeof pubkey !== 'string')
    return res.status(400).json({ error: 'pubkey is required' })
  if (!BASE58_REGEX.test(pubkey))
    return res.status(400).json({ error: 'Invalid Base58 public key format' })

  try {
    new PublicKey(pubkey)
  } catch {
    return res.status(400).json({ error: 'Invalid Solana public key' })
  }

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()
  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor')
    return res.status(403).json({ error: 'Wallets are only available for contractors' })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ solana_pubkey: pubkey })
    .eq('id', userId)
  if (error) {
    console.error('[wallet/save-pubkey] DB error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  console.log(`[wallet/save-pubkey] Saved pubkey for user ${userId}`)
  res.json({ success: true })
})

router.get('/api/wallet/status', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select('solana_pubkey, account_type')
    .eq('id', userId)
    .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor')
    return res.status(403).json({ error: 'Wallets are only available for contractors' })

  res.json({ solana_pubkey: userRow.solana_pubkey ?? null })
})

router.post('/api/wallet/remove', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: userRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()
  if (!userRow) return res.status(404).json({ error: 'User not found' })
  if (userRow.account_type !== 'contractor')
    return res.status(403).json({ error: 'Wallets are only available for contractors' })

  const { error } = await supabaseAdmin
    .from('users')
    .update({ solana_pubkey: null })
    .eq('id', userId)
  if (error) {
    console.error('[wallet/remove] DB error:', error.message)
    return res.status(500).json({ error: error.message })
  }

  console.log(`[wallet/remove] Cleared pubkey for user ${userId}`)
  res.json({ success: true })
})

router.post('/api/wallet/send-reward', requireAuth, async (req, res) => {
  const userId = req.user.id

  const { data: adminRow } = await supabaseAdmin
    .from('users')
    .select('account_type')
    .eq('id', userId)
    .single()
  if (adminRow?.account_type !== 'admin') return res.status(403).json({ error: 'Admin only' })

  const { recipientPubkey, amountSol } = req.body ?? {}
  if (!recipientPubkey || !Number.isFinite(amountSol) || amountSol <= 0) {
    return res.status(400).json({ error: 'recipientPubkey and a positive amountSol are required' })
  }

  const treasuryKeyRaw = process.env.SOLANA_TREASURY_PRIVATE_KEY
  if (!treasuryKeyRaw)
    return res.status(503).json({ error: 'SOLANA_TREASURY_PRIVATE_KEY not configured' })

  let treasuryKeypair
  try {
    const keyArray = JSON.parse(treasuryKeyRaw)
    treasuryKeypair = Keypair.fromSecretKey(Uint8Array.from(keyArray))
  } catch {
    return res.status(500).json({ error: 'Invalid treasury key format' })
  }

  let recipientKey
  try {
    recipientKey = new PublicKey(recipientPubkey)
  } catch {
    return res.status(400).json({ error: 'Invalid recipient public key' })
  }

  try {
    const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed')
    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL)
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: recipientKey,
        lamports,
      })
    )
    const signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair])
    console.log(
      `[wallet/send-reward] Sent ${amountSol} SOL to ${recipientPubkey}. Sig: ${signature}`
    )
    res.json({ success: true, signature })
  } catch (err) {
    console.error('[wallet/send-reward] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
