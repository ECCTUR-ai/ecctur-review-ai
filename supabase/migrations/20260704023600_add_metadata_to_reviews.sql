-- Migration: Add metadata column to public.reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
