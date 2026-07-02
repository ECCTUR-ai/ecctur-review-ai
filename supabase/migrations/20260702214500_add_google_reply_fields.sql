-- Migration: Add Google Business Profile reply publisher log fields to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS published_platform TEXT,
ADD COLUMN IF NOT EXISTS owner_reply_text TEXT,
ADD COLUMN IF NOT EXISTS owner_reply_status TEXT;
