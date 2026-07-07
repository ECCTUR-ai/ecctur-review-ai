-- Migration: Configure secure RLS policies for tasks table
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplication conflicts
DROP POLICY IF EXISTS "Allow select for authenticated users on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow insert for authenticated users on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow update for authenticated users on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow delete for authenticated users on tasks" ON public.tasks;

-- 1. Select Policy
CREATE POLICY "Allow select for authenticated users on tasks" ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai')) OR
    (organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
  );

-- 2. Insert Policy
CREATE POLICY "Allow insert for authenticated users on tasks" ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() ->> 'email' IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai')) OR
    (organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
  );

-- 3. Update Policy
CREATE POLICY "Allow update for authenticated users on tasks" ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai')) OR
    (organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
  )
  WITH CHECK (
    (auth.jwt() ->> 'email' IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai')) OR
    (organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
  );

-- 4. Delete Policy
CREATE POLICY "Allow delete for authenticated users on tasks" ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() ->> 'email' IN ('cemil.sezgin@ecctur.com', 'admin@ecctur.ai')) OR
    (organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ))
  );
