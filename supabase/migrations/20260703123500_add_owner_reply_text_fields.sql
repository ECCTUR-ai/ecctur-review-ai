-- Migration: Add owner reply text and logging fields to reviews table
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS owner_reply_text text,
  ADD COLUMN IF NOT EXISTS owner_reply_status text,
  ADD COLUMN IF NOT EXISTS owner_reply_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS owner_reply_error text,
  ADD COLUMN IF NOT EXISTS google_reply_status text,
  ADD COLUMN IF NOT EXISTS google_reply_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_reply_error text;
