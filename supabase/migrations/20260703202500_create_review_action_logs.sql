-- Migration: Create review_action_logs table for audit trail logging
CREATE TABLE IF NOT EXISTS public.review_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL,
    hotel_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('approved', 'published', 'sent_to_whatsapp', 'regenerated', 'edited')),
    action_by_user_id UUID,
    action_by_user_email VARCHAR(255),
    action_by_user_name VARCHAR(255),
    action_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    platform VARCHAR(50),
    guest_name VARCHAR(255),
    review_reply_text TEXT,
    ai_generated BOOLEAN DEFAULT false,
    whatsapp_sent_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    ip_address VARCHAR(50),
    user_agent TEXT
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_review_action_logs_hotel_id ON public.review_action_logs(hotel_id);
CREATE INDEX IF NOT EXISTS idx_review_action_logs_review_id ON public.review_action_logs(review_id);

-- Disable Row Level Security to align with other client-accessible tables
ALTER TABLE public.review_action_logs DISABLE ROW LEVEL SECURITY;
