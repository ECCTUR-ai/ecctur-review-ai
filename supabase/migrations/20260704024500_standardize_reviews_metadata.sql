-- Migration: Standardize reviews metadata and dates
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS travel_date TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS owner_response_text TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS owner_response_date TEXT;

-- Backfill Booking review_date from metadata if present
UPDATE public.reviews
SET review_date = metadata->>'reviewDate'
WHERE (platform = 'booking' OR platform = 'Booking') 
  AND metadata IS NOT NULL 
  AND metadata->>'reviewDate' IS NOT NULL;

-- Backfill TripAdvisor review_date from metadata if present
UPDATE public.reviews
SET review_date = metadata->>'publishedDate'
WHERE (platform = 'tripadvisor' OR platform = 'TripAdvisor') 
  AND metadata IS NOT NULL 
  AND metadata->>'publishedDate' IS NOT NULL;

-- Reset review_date to NULL if it is import time (equal to created_at or within 30 seconds range)
-- and metadata does not specify a real date
UPDATE public.reviews
SET review_date = NULL
WHERE review_date IS NOT NULL
  AND (
    -- Convert timestamps safely to perform comparison
    ABS(EXTRACT(EPOCH FROM (review_date::timestamptz - created_at::timestamptz))) < 30
  )
  AND (
    metadata IS NULL 
    OR metadata = '{}'::jsonb
    OR (metadata->>'reviewDate' IS NULL AND metadata->>'publishedDate' IS NULL)
  );
