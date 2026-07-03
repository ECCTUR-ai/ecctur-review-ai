-- Migration: Add booking_url column to public.hotels table
ALTER TABLE public.hotels ADD COLUMN IF NOT EXISTS booking_url TEXT;
