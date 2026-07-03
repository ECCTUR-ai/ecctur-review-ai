-- Migration: Add hotelscom_url column to public.hotels table
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS hotelscom_url TEXT;
