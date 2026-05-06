ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "schedule" text;
--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "alert_threshold" integer;
--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "alert_destination" text;
--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "webhook_token" text;
--> statement-breakpoint
ALTER TABLE "simulations" ADD COLUMN IF NOT EXISTS "last_alerted_at" timestamp with time zone;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "simulations_webhook_token_unique" ON "simulations" ("webhook_token") WHERE "webhook_token" IS NOT NULL;
--> statement-breakpoint
UPDATE "simulations" SET "webhook_token" = gen_random_uuid()::text WHERE "webhook_token" IS NULL;
