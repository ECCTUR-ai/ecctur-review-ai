-- Create table organizations
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table hotels
CREATE TABLE IF NOT EXISTS public.hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add organization_id and hotel_id support to reviews, tasks, and notifications
ALTER TABLE public.reviews 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

ALTER TABLE public.notifications 
    ADD COLUMN IF NOT EXISTS hotel_id UUID REFERENCES public.hotels(id) ON DELETE SET NULL;

-- Insert seed organization: ECCTUR
INSERT INTO public.organizations (id, name)
VALUES ('7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', 'ECCTUR')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Insert seed hotels
INSERT INTO public.hotels (id, organization_id, name)
VALUES 
    ('00c00000-0000-0000-0000-000000000001', '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', 'ECCTUR Demo Hotel'),
    ('00c00000-0000-0000-0000-000000000002', '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', 'Montana 2543'),
    ('00c00000-0000-0000-0000-000000000003', '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7', 'Fahri Heritage Hotel')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, organization_id = EXCLUDED.organization_id;

-- Safe update: If existing reviews have no hotel_id, assign them to ECCTUR Demo Hotel
UPDATE public.reviews
SET hotel_id = '00c00000-0000-0000-0000-000000000001',
    organization_id = '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
WHERE hotel_id IS NULL;

-- Safe update: If existing tasks have no hotel_id, assign them to ECCTUR Demo Hotel
UPDATE public.tasks
SET hotel_id = '00c00000-0000-0000-0000-000000000001',
    organization_id = '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
WHERE hotel_id IS NULL;

-- Safe update: If existing notifications have no hotel_id, assign them to ECCTUR Demo Hotel
UPDATE public.notifications
SET hotel_id = '00c00000-0000-0000-0000-000000000001'
WHERE hotel_id IS NULL;
