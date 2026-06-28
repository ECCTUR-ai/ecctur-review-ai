-- Add organization_id to profiles table
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

-- Associate existing profiles with the default ECCTUR organization
UPDATE public.profiles
SET organization_id = '7cc77cc7-7cc7-7cc7-7cc7-7cc77cc77cc7'
WHERE organization_id IS NULL;
