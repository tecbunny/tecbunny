-- Fix: 42P17 infinite recursion on products, orders, and quotes RLS policies.
--
-- Problem: The "Admins can manage *" policies on products, orders, and quotes use:
--   EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
-- When Postgres evaluates these policies it reads from `profiles`, which has RLS.
-- The `profiles` "Admins can manage profiles" policy then triggers the same subquery,
-- causing an infinite recursion loop (42P17).
--
-- Fix: Replace all self-referencing admin-check subqueries with public.is_admin_user(),
-- the SECURITY DEFINER function created in 20260601120000_fix_profiles_rls_recursion.sql.
-- SECURITY DEFINER functions bypass RLS, so there is no recursive policy evaluation.
--
-- References: Supabase docs on RLS policy recursion (https://supabase.com/docs/guides/database/postgres/row-level-security#use-security-definer-functions)

-- ─── PRODUCTS ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

CREATE POLICY "Admins can manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());


-- ─── ORDERS ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;

CREATE POLICY "Admins can manage orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());


-- ─── QUOTES ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quotes;

CREATE POLICY "Admins can manage quotes"
ON public.quotes
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());
