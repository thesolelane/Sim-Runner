-- Migration 015: Add Solana wallet public key to users table
-- The private key is NEVER stored server-side.
-- Only the Base58 public key (wallet address) is recorded here for reward drops.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS solana_pubkey TEXT UNIQUE NULL;
