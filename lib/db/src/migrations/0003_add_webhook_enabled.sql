ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "webhook_enabled" boolean NOT NULL DEFAULT true;
