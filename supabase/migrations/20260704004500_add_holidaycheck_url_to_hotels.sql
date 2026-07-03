-- Migration: Add holidaycheck_url column to public.hotels table
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS holidaycheck_url TEXT;
