ALTER TABLE simulations ADD COLUMN IF NOT EXISTS scan_type text NOT NULL DEFAULT 'web';
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS chain_id text;
ALTER TABLE simulations ADD COLUMN IF NOT EXISTS target_address text;
ALTER TABLE simulation_runs ADD COLUMN IF NOT EXISTS blockchain_scan_result jsonb;
