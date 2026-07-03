-- Migration: Ensure hotel_name column exists and sync it from public.hotels to public.reviews table
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS hotel_name TEXT;

UPDATE public.reviews
SET hotel_name = public.hotels.name
FROM public.hotels
WHERE public.reviews.hotel_id = public.hotels.id;
