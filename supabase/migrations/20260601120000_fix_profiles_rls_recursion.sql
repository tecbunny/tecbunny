-- Fix: 42P17 infinite recursion in profiles RLS policy.
--
-- Problem: "Admins can manage profiles" used:
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- This is a self-referential query on the 'profiles' table, which itself has RLS enabled.
-- When Postgres evaluates the policy for a SELECT on profiles, it triggers the same policy
-- again, causing an infinite recursion loop (42P17).
--
-- Fix: Replace the self-referencing subquery with a SECURITY DEFINER function that
-- bypasses RLS. This is the standard Supabase pattern for admin-check policies on
-- tables that reference themselves.

-- Step 1: Create a SECURITY DEFINER helper that checks admin role without triggering RLS.
--         set_config is NOT used here; we query auth.uid() directly inside a definer fn.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

-- Revoke broad execute, grant only to authenticated (same as before, but safe now).
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

-- Step 2: Drop the broken recursive policy on profiles.
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

-- Step 3: Recreate it using the security-definer function (no self-reference in policy body).
CREATE POLICY "Admins can manage profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Step 4: Also fix any other tables that do the same recursive pattern via inline subquery.
--         These aren't self-referential but keeping them consistent is a good practice.
--         They already use (select auth.uid()) optimization, so they're fine as-is.
--         No changes needed for products/orders/quotes/analytics/leads policies.
