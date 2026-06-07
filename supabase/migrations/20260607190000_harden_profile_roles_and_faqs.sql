-- Harden role-bearing profile fields and FAQ admin policy.

CREATE OR REPLACE FUNCTION public.prevent_unsafe_profile_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF auth.role() = 'service_role' OR public.is_admin_user() THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'profiles.role can only be changed by trusted administrators'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unsafe_profile_role_change ON public.profiles;
CREATE TRIGGER prevent_unsafe_profile_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unsafe_profile_role_change();

REVOKE UPDATE (role) ON TABLE public.profiles FROM anon, authenticated;

DROP POLICY IF EXISTS "Allow full access to admin users" ON public.faqs;
CREATE POLICY "Allow full access to admin users"
ON public.faqs
FOR ALL
TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
)
WITH CHECK (
  ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
);

REVOKE EXECUTE ON FUNCTION public.prevent_unsafe_profile_role_change() FROM PUBLIC, anon, authenticated;
