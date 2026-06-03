-- ============================================================================
-- Migration: Add icon_name column to services table
-- File:      20260604000500_services_icon_name.sql
-- Purpose:   The application code references services.icon_name but the column
--            does not exist in the remote database, causing a build-time error:
--            "column services.icon_name does not exist" (code 42703).
--            This migration adds the column safely with IF NOT EXISTS guards
--            and also ensures the full services table exists if it was never
--            created (for fresh environments).
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Ensure the services table exists (idempotent)
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.services (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  name          TEXT,
  description   TEXT,
  details       TEXT,
  icon          TEXT,
  icon_name     TEXT,
  badge         TEXT,
  features      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  feature_list  JSONB,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  status        TEXT          DEFAULT 'active',
  price         NUMERIC(12,2),
  duration_days INTEGER,
  category      TEXT          DEFAULT 'Support',
  display_order INTEGER       NOT NULL DEFAULT 0,
  created_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Add icon_name if the table already existed without it
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Indexes for common query patterns
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_services_is_active      ON public.services (is_active);
CREATE INDEX IF NOT EXISTS idx_services_category       ON public.services (category);
CREATE INDEX IF NOT EXISTS idx_services_display_order  ON public.services (display_order);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. RLS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Public can read active services (used by /services SSG page)
DROP POLICY IF EXISTS services_public_read  ON public.services;
CREATE POLICY services_public_read  ON public.services
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- Staff (admin / manager) can read all services including inactive ones
DROP POLICY IF EXISTS services_admin_read   ON public.services;
CREATE POLICY services_admin_read   ON public.services
  FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

-- Only admins / managers can write (insert, update, delete)
DROP POLICY IF EXISTS services_admin_write  ON public.services;
CREATE POLICY services_admin_write  ON public.services
  FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- 5. updated_at auto-update trigger (reuse shared helper if it exists)
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  ) THEN
    -- Trigger already attached from another migration; recreate safely
    DROP TRIGGER IF EXISTS trg_services_updated_at ON public.services;
    CREATE TRIGGER trg_services_updated_at
      BEFORE UPDATE ON public.services
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END;
$$;

COMMIT;
