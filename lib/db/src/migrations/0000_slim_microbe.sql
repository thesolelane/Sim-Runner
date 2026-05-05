CREATE TABLE IF NOT EXISTS "simulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"app_name" text NOT NULL,
	"app_url" text NOT NULL,
	"app_type" text NOT NULL,
	"steps" jsonb NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"last_run_status" text,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"simulation_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_steps" integer DEFAULT 0 NOT NULL,
	"passed_steps" integer DEFAULT 0 NOT NULL,
	"failed_steps" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"headed_mode" boolean DEFAULT false NOT NULL,
	"video_path" text,
	"step_results" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "simulation_runs" ADD CONSTRAINT "simulation_runs_simulation_id_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."simulations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
