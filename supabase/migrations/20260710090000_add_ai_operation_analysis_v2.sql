-- Migration: Add AI Operation Analysis V2 columns to reviews table
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS ai_operation_analysis JSONB,
ADD COLUMN IF NOT EXISTS ai_operation_analysis_version TEXT,
ADD COLUMN IF NOT EXISTS ai_operation_analysis_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS ai_operation_analysis_model TEXT,
ADD COLUMN IF NOT EXISTS ai_operation_analysis_confidence INTEGER;
