-- Migration: Add soft delete columns to hotels table
ALTER TABLE public.hotels
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for filtering soft-deleted hotels efficiently
CREATE INDEX IF NOT EXISTS idx_hotels_is_deleted ON public.hotels(is_deleted);

-- Mark test hotels explicitly
UPDATE public.hotels
SET is_test = TRUE
WHERE name ILIKE '%test%' OR name ILIKE '%demo%';
