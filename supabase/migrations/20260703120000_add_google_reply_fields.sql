-- Migration: Add Google Reply Fields to reviews table
ALTER TABLE reviews 
  ADD COLUMN IF NOT EXISTS google_reply_status text,
  ADD COLUMN IF NOT EXISTS google_reply_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_reply_error text;
