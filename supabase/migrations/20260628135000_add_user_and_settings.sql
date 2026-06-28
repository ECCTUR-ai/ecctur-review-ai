-- Create table roles
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create table user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, role_id)
);

-- Create table user_hotels
CREATE TABLE IF NOT EXISTS public.user_hotels (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    hotel_id UUID NOT NULL REFERENCES public.hotels(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, hotel_id)
);

-- Create table integration_settings
CREATE TABLE IF NOT EXISTS public.integration_settings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed roles
INSERT INTO public.roles (id, name, description)
VALUES 
    ('8a800000-0000-0000-0000-000000000001', 'Super Admin', 'Full platform access and database admin capabilities.'),
    ('8a800000-0000-0000-0000-000000000002', 'Admin', 'Administrative access to manage users and hotels.'),
    ('8a800000-0000-0000-0000-000000000003', 'Hotel Manager', 'Access to manage specific hotels and tasks.'),
    ('8a800000-0000-0000-0000-000000000004', 'Department Manager', 'Access to specific departments inside a hotel.'),
    ('8a800000-0000-0000-0000-000000000005', 'Staff', 'General staff access to view reviews and complete tasks.'),
    ('8a800000-0000-0000-0000-000000000006', 'Read Only', 'Read only access across assigned hotels.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed default user profiles
INSERT INTO public.profiles (id, email, first_name, last_name, status)
VALUES 
    ('9a900000-0000-0000-0000-000000000001', 'admin@ecctur.ai', 'Cemil', 'Sezgin', 'active'),
    ('9a900000-0000-0000-0000-000000000002', 'manager@ecctur.ai', 'Ahmet', 'Yılmaz', 'active'),
    ('9a900000-0000-0000-0000-000000000003', 'staff@ecctur.ai', 'Mehmet', 'Demir', 'active')
ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, status = EXCLUDED.status;

-- Assign roles to seeded users
INSERT INTO public.user_roles (profile_id, role_id)
VALUES 
    ('9a900000-0000-0000-0000-000000000001', '8a800000-0000-0000-0000-000000000001'), -- admin is Super Admin
    ('9a900000-0000-0000-0000-000000000002', '8a800000-0000-0000-0000-000000000003'), -- manager is Hotel Manager
    ('9a900000-0000-0000-0000-000000000003', '8a800000-0000-0000-0000-000000000005')  -- staff is Staff
ON CONFLICT (profile_id, role_id) DO NOTHING;

-- Assign hotel access (ECCTUR Demo Hotel) to manager and staff
INSERT INTO public.user_hotels (profile_id, hotel_id)
VALUES 
    ('9a900000-0000-0000-0000-000000000002', '00c00000-0000-0000-0000-000000000001'), -- Manager has access to Demo Hotel
    ('9a900000-0000-0000-0000-000000000003', '00c00000-0000-0000-0000-000000000001')  -- Staff has access to Demo Hotel
ON CONFLICT (profile_id, hotel_id) DO NOTHING;

-- Seed integration settings
INSERT INTO public.integration_settings (id, name, status)
VALUES 
    ('google_business', 'Google Business API', 'connected'),
    ('whatsapp', 'WhatsApp Business API', 'connected'),
    ('n8n', 'n8n Webhook Pipeline', 'connected'),
    ('supabase', 'Supabase Cloud Storage', 'connected')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, status = EXCLUDED.status;
