-- supabase/migrations/20260702120000_add_booking_property_id.sql

-- 1. Extend hotels table with booking_property_id
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS booking_property_id TEXT;
