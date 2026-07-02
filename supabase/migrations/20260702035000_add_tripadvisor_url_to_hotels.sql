-- supabase/migrations/20260702035000_add_tripadvisor_url_to_hotels.sql
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS tripadvisor_url TEXT;
