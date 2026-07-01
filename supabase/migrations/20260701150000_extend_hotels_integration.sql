-- supabase/migrations/20260701150000_extend_hotels_integration.sql

-- 1. Extend hotels table with Google Business integration fields
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS google_account_id TEXT,
ADD COLUMN IF NOT EXISTS google_location_id TEXT,
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
ADD COLUMN IF NOT EXISTS google_business_name TEXT,
ADD COLUMN IF NOT EXISTS google_business_connected BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Extend integration_settings table
ALTER TABLE public.integration_settings
ADD COLUMN IF NOT EXISTS organization_id UUID,
ADD COLUMN IF NOT EXISTS hotel_id UUID,
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add foreign key constraints if columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hotels') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integration_settings' AND column_name = 'hotel_id') THEN
    ALTER TABLE public.integration_settings
    DROP CONSTRAINT IF EXISTS fk_integration_settings_hotel,
    ADD CONSTRAINT fk_integration_settings_hotel FOREIGN KEY (hotel_id) REFERENCES public.hotels(id) ON DELETE CASCADE;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organizations') AND
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'integration_settings' AND column_name = 'organization_id') THEN
    ALTER TABLE public.integration_settings
    DROP CONSTRAINT IF EXISTS fk_integration_settings_org,
    ADD CONSTRAINT fk_integration_settings_org FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
