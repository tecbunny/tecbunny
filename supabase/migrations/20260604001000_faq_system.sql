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

-- 3. Create public policy (Allow SELECT if is_published = true)
CREATE POLICY "Allow public read access to published FAQs"
ON public.faqs
FOR SELECT
USING (is_published = true);

-- 4. Create admin policies (Allow ALL CRUD for admin roles)
-- We assume admin checks are normally done by application tier server-role-guard, 
-- but we also add a database policy allowing users with app_metadata->>'role' = 'admin' or 'super_admin'
-- or similar if they interact directly.
-- If the project uses a specific `role` column in `profiles`, you can join it.
-- For standard Next.js backend API usage (where service_role bypasses RLS or API routes use service_role/validate),
-- this policy supports authenticated admins.
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

-- 5. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 6. Attach trigger to faqs table
DROP TRIGGER IF EXISTS set_faqs_updated_at ON public.faqs;
CREATE TRIGGER set_faqs_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Note: In Supabase, usually the service role key bypasses RLS. 
-- For API routes, if using `createServerClient` with the user's session, RLS applies. 
-- Ensure the admin role checks in `requireApiRole` align with these JWT policies.
