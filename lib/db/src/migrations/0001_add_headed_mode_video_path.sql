ALTER TABLE "simulation_runs" ADD COLUMN IF NOT EXISTS "headed_mode" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "simulation_runs" ADD COLUMN IF NOT EXISTS "video_path" text;
