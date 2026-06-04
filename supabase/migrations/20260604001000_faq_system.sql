-- Supabase SQL Migration: FAQ System
-- file: supabase/migrations/20260604001000_faq_system.sql

-- 1. Create table `faqs`
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

-- 3. Create performance index
CREATE INDEX IF NOT EXISTS faqs_published_category_order_idx ON public.faqs (is_published, category, display_order);

-- 4. Create public policy (Allow SELECT if is_published = true)
DROP POLICY IF EXISTS "Allow public read access to published FAQs" ON public.faqs;
CREATE POLICY "Allow public read access to published FAQs"
ON public.faqs
FOR SELECT
USING (is_published = true);

-- 5. Create admin policies (Allow ALL CRUD for admin roles)
DROP POLICY IF EXISTS "Allow full access to admin users" ON public.faqs;
CREATE POLICY "Allow full access to admin users"
ON public.faqs
FOR ALL
TO authenticated
USING (
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'))
    OR
    ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'))
)
WITH CHECK (
    ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'))
    OR
    ((auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'))
);

-- 6. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 7. Attach trigger to faqs table
DROP TRIGGER IF EXISTS set_faqs_updated_at ON public.faqs;
CREATE TRIGGER set_faqs_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
