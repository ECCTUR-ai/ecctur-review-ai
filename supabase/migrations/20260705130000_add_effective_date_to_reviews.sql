-- Migration: Add effective_date to reviews table for unified sorting
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS effective_date TIMESTAMPTZ;

-- Backfill existing records
UPDATE public.reviews
SET effective_date = COALESCE(review_date, created_at);

-- Create trigger to automatically maintain effective_date
CREATE OR REPLACE FUNCTION public.set_effective_date()
RETURNS TRIGGER AS $$
BEGIN
    NEW.effective_date := COALESCE(NEW.review_date, NEW.created_at);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_set_effective_date ON public.reviews;
CREATE TRIGGER tr_set_effective_date
    BEFORE INSERT OR UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.set_effective_date();
