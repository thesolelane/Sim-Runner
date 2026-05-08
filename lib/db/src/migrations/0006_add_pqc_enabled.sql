ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "pqc_enabled" boolean NOT NULL DEFAULT false;
