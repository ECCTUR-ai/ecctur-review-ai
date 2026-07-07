-- Migration: Create action_resolutions table
CREATE TABLE IF NOT EXISTS action_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  action_key text NOT NULL,
  action_title text NOT NULL,
  action_description text,
  source_period text NOT NULL,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, action_key, source_period)
);

-- Indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_action_resolutions_hotel_id ON action_resolutions(hotel_id);
CREATE INDEX IF NOT EXISTS idx_action_resolutions_action_key ON action_resolutions(action_key);
CREATE INDEX IF NOT EXISTS idx_action_resolutions_source_period ON action_resolutions(source_period);

-- Enable Row Level Security (RLS)
ALTER TABLE action_resolutions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they already exist to ensure idempotency
DROP POLICY IF EXISTS "Allow select for authenticated users" ON action_resolutions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON action_resolutions;
DROP POLICY IF EXISTS "Allow update for authenticated users" ON action_resolutions;

-- Enable clean CRUD policies for authenticated roles
CREATE POLICY "Allow select for authenticated users" ON action_resolutions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert for authenticated users" ON action_resolutions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update for authenticated users" ON action_resolutions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
