-- Migration: Add unique index constraint to reviews table to prevent duplicate platform imports
DELETE FROM public.reviews a USING public.reviews b
WHERE a.id > b.id
  AND a.hotel_id = b.hotel_id
  AND a.platform = b.platform
  AND a.platform_review_id IS NOT NULL
  AND a.platform_review_id = b.platform_review_id;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_hotel_platform_external_uidx
ON public.reviews (hotel_id, platform, platform_review_id)
WHERE platform_review_id IS NOT NULL;


