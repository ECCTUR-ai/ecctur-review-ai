-- supabase/migrations/20260702023000_unify_google_maps_url.sql
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS google_maps_url TEXT;

-- Copy any existing links to the unified column
UPDATE public.hotels
SET google_maps_url = google_maps_link
WHERE google_maps_url IS NULL AND google_maps_link IS NOT NULL;
