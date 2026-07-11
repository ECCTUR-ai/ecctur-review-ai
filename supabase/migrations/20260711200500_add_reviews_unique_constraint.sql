-- Migration: Add unique index constraint to reviews table to prevent duplicate platform imports
CREATE UNIQUE INDEX IF NOT EXISTS reviews_hotel_platform_external_uidx
ON public.reviews (hotel_id, platform, external_review_id)
WHERE external_review_id IS NOT NULL;
