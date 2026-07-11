-- Migration: Add otelpuan_url column to public.hotels table
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS otelpuan_url TEXT;
