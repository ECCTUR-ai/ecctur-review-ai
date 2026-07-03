-- Migration: Seed missing roles into roles table if they do not exist
INSERT INTO public.roles (id, name, description)
VALUES 
    ('8a800000-0000-0000-0000-000000000001', 'Super Admin', 'Full platform access and database admin capabilities.'),
    ('8a800000-0000-0000-0000-000000000002', 'Admin', 'Administrative access to manage users and hotels.'),
    ('8a800000-0000-0000-0000-000000000003', 'Hotel Manager', 'Access to manage specific hotels and tasks.'),
    ('8a800000-0000-0000-0000-000000000004', 'Department Manager', 'Access to specific departments inside a hotel.'),
    ('8a800000-0000-0000-0000-000000000005', 'Staff', 'General staff access to view reviews and complete tasks.'),
    ('8a800000-0000-0000-0000-000000000006', 'Read Only', 'Read only access across assigned hotels.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;
