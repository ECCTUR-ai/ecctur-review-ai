-- Disable Row Level Security (RLS) on auth and management tables
-- This ensures the client-side anon key can read and write to these tables
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings DISABLE ROW LEVEL SECURITY;
