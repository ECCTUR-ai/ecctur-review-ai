-- Migration: Create hotel_review_integrations and review_sync_logs tables
-- Description: Independent platform integration registration, status tracking, and sync logging

CREATE TABLE IF NOT EXISTS public.hotel_review_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  platform TEXT NOT NULL, -- 'google', 'booking', 'tripadvisor', 'hotels', 'holidaycheck', 'otelpuan'
  provider TEXT NOT NULL DEFAULT 'apify', -- 'apify', 'custom', 'official_api'
  source_url TEXT,
  external_hotel_id TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sync_status TEXT NOT NULL DEFAULT 'idle', -- 'idle', 'syncing', 'success', 'error', 'disabled'
  last_sync_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  last_imported_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_hotel_platform UNIQUE (hotel_id, platform)
);

CREATE TABLE IF NOT EXISTS public.review_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  imported_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.hotel_review_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sync_logs ENABLE ROW LEVEL SECURITY;

-- Permissive policies for authenticated users
CREATE POLICY "Allow authenticated read on hotel_review_integrations"
  ON public.hotel_review_integrations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert/update on hotel_review_integrations"
  ON public.hotel_review_integrations FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow service_role full access on hotel_review_integrations"
  ON public.hotel_review_integrations FOR ALL TO service_role USING (true);

CREATE POLICY "Allow authenticated read on review_sync_logs"
  ON public.review_sync_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert on review_sync_logs"
  ON public.review_sync_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow service_role full access on review_sync_logs"
  ON public.review_sync_logs FOR ALL TO service_role USING (true);

-- Auto-seed integrations for existing hotels using current URL fields
DO $$
DECLARE
  h RECORD;
BEGIN
  FOR h IN SELECT id, google_maps_url, google_maps_link, booking_url, tripadvisor_url, hotelscom_url, holidaycheck_url, otelpuan_url FROM public.hotels LOOP
    -- Google
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'google', 'apify', COALESCE(h.google_maps_url, h.google_maps_link), COALESCE(h.google_maps_url, h.google_maps_link) IS NOT NULL AND COALESCE(h.google_maps_url, h.google_maps_link) <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;

    -- Booking
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'booking', 'apify', h.booking_url, h.booking_url IS NOT NULL AND h.booking_url <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;

    -- TripAdvisor
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'tripadvisor', 'apify', h.tripadvisor_url, h.tripadvisor_url IS NOT NULL AND h.tripadvisor_url <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;

    -- Hotels.com
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'hotels', 'apify', h.hotelscom_url, h.hotelscom_url IS NOT NULL AND h.hotelscom_url <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;

    -- HolidayCheck
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'holidaycheck', 'apify', h.holidaycheck_url, h.holidaycheck_url IS NOT NULL AND h.holidaycheck_url <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;

    -- Otelpuan
    INSERT INTO public.hotel_review_integrations (hotel_id, platform, provider, source_url, is_enabled)
    VALUES (h.id, 'otelpuan', 'custom', h.otelpuan_url, h.otelpuan_url IS NOT NULL AND h.otelpuan_url <> '')
    ON CONFLICT (hotel_id, platform) DO UPDATE
    SET source_url = EXCLUDED.source_url,
        is_enabled = CASE WHEN EXCLUDED.source_url IS NOT NULL AND EXCLUDED.source_url <> '' THEN true ELSE hotel_review_integrations.is_enabled END;
  END LOOP;
END $$;
