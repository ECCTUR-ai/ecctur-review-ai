-- Migration: Create action_resolutions table
CREATE TABLE IF NOT EXISTS action_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id uuid NOT NULL,
  action_key text NOT NULL,
  action_title text NOT NULL,
  action_description text,
  source_period text,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (hotel_id, action_key, source_period)
);

-- Enable Row Level Security (RLS)
ALTER TABLE action_resolutions ENABLE ROW LEVEL SECURITY;

-- Enable clean read/write policies for authenticated roles
CREATE POLICY "Allow read for authenticated users" ON action_resolutions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow write for authenticated users" ON action_resolutions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
