-- supabase/migrations/20260705183500_create_review_sync_states.sql
CREATE TABLE IF NOT EXISTS review_sync_states (
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_successful_sync_at TIMESTAMP WITH TIME ZONE,
    last_review_date TIMESTAMP WITH TIME ZONE,
    last_review_count INTEGER DEFAULT 0,
    last_imported_count INTEGER DEFAULT 0,
    last_duplicate_count INTEGER DEFAULT 0,
    last_error_count INTEGER DEFAULT 0,
    sync_mode VARCHAR(50) DEFAULT 'initial_full_sync',
    status VARCHAR(50) DEFAULT 'idle',
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    PRIMARY KEY (hotel_id, platform)
);

-- Enable RLS
ALTER TABLE review_sync_states ENABLE ROW LEVEL SECURITY;

-- Create policy for select/insert/update
CREATE POLICY "Allow all actions for authenticated users on sync states" 
    ON review_sync_states 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);
