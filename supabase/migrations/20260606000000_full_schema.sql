-- Consolidated Supabase schema migration
-- Generated from the previous migration sequence on 2026-06-06.
-- Keep this as the single source migration for fresh database setup.

BEGIN;

-- ============================================================================
-- Source: 20260604000000_combined_schema.sql
-- ============================================================================

-- ============================================================================
-- Migration: Unified E-Commerce Database Schema
-- File:      20260604000000_combined_schema.sql
-- Purpose:   Consolidates all previous migrations (quotes, innovation content,
--            security fixes, RLS recursion fixes, soft delete, atomic checkout,
--            media gatekeepers, serial inventory allocations, and tiered pricing)
--            into a single clean and optimized initial script.
-- ============================================================================


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Custom Enums & Types
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('created', 'sent', 'downloaded', 'expired');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_lifecycle_status') THEN
    CREATE TYPE product_lifecycle_status AS ENUM ('active', 'draft', 'archived', 'discontinued');
  END IF;
END;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Table Creation (New Tables Added via Migrations)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Quotes Table
CREATE TABLE IF NOT EXISTS public.quotes (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         REFERENCES auth.users (id) ON DELETE CASCADE,
  customer_name TEXT        NOT NULL,
  customer_email TEXT       NOT NULL,
  gst_included BOOLEAN      NOT NULL DEFAULT FALSE,
  expiry_at    TIMESTAMPTZ  NOT NULL,
  summary      TEXT,
  selections   JSONB,
  pdf_url      TEXT,
  status       quote_status NOT NULL DEFAULT 'created',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quotes_user_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_expiry_idx ON public.quotes(expiry_at);

-- Innovation Content Tables
CREATE TABLE IF NOT EXISTS public.innovation_modes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT        UNIQUE NOT NULL,
  label         TEXT        NOT NULL,
  sub           TEXT        NOT NULL,
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  icon          TEXT        NOT NULL,
  rec_id        TEXT        NOT NULL,
  items         JSONB       NOT NULL DEFAULT '[]'::JSONB,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.innovation_devices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  accent        TEXT        NOT NULL,
  icon          TEXT        NOT NULL,
  chips         JSONB       NOT NULL DEFAULT '[]'::JSONB,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Stock Movements Ledger Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID          NOT NULL, -- FK added below once products exists
  movement_type    TEXT          NOT NULL,
  quantity_delta   INTEGER       NOT NULL,
  quantity_before  INTEGER       NOT NULL DEFAULT 0,
  quantity_after   INTEGER       NOT NULL DEFAULT 0,
  reference_id     TEXT,
  reference_type   TEXT          NOT NULL DEFAULT 'manual',
  notes            TEXT,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_by       UUID          REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Immutable audit ledger rules for stock movements
CREATE OR REPLACE RULE stock_movements_no_update AS
  ON UPDATE TO public.stock_movements DO INSTEAD NOTHING;

CREATE OR REPLACE RULE stock_movements_no_delete AS
  ON DELETE TO public.stock_movements DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON public.stock_movements (movement_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements (created_at DESC);

-- Serialized Inventory Table
CREATE TABLE IF NOT EXISTS public.inventory (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID          NOT NULL UNIQUE, -- FK added below
  stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  serial_numbers  TEXT[]        NOT NULL DEFAULT '{}'::TEXT[],
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);

-- Product Pricing Matrix Table
CREATE TABLE IF NOT EXISTS public.product_pricing (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID          NOT NULL, -- FK added below
  customer_type     TEXT          NOT NULL CHECK (customer_type IN ('B2C', 'B2B')),
  customer_category TEXT          NOT NULL CHECK (customer_category IN ('Normal', 'Standard', 'Premium', 'Bronze', 'Silver', 'Gold', 'sales_agent', 'walk_in')),
  price             NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  min_quantity      INTEGER       NOT NULL DEFAULT 1 CHECK (min_quantity >= 1),
  max_quantity      INTEGER       NOT NULL DEFAULT 999999 CHECK (max_quantity >= 1),
  valid_from        TIMESTAMPTZ   DEFAULT NOW(),
  valid_to          TIMESTAMPTZ   DEFAULT NULL,
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  
  CONSTRAINT check_qty_range CHECK (min_quantity <= max_quantity)
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_lookup ON public.product_pricing (product_id, customer_type, customer_category, is_active);

-- Product Archive Compliance Log Table
CREATE TABLE IF NOT EXISTS public.product_archive_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL,
  product_title TEXT,
  action       TEXT        NOT NULL CHECK (action IN ('archived', 'restored', 'permanently_deleted')),
  performed_by UUID,
  reason       TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot     JSONB
);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Core Table Enhancements (Altering existing tables)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Add columns to public.products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status                    product_lifecycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS images                    TEXT[]        DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS is_serial_number_compulsory BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at                TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by                UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_deleted                BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archive_reason            TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_at               TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by               UUID          DEFAULT NULL;

-- Backfill archived status
UPDATE public.products
SET
  is_deleted  = TRUE,
  deleted_at  = COALESCE(updated_at, NOW()),
  archive_reason = 'Pre-migration archived status'
WHERE
  status = 'archived'
  AND is_deleted = FALSE;

-- Now add Foreign Keys for tables referencing products
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE public.product_pricing ADD CONSTRAINT product_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Optimize indexation on orders and webhooks
CREATE INDEX IF NOT EXISTS idx_orders_active_created ON public.orders (created_at DESC) WHERE status != 'Cancelled' AND status != 'Rejected';
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- Product Catalog Indexes
CREATE INDEX IF NOT EXISTS idx_products_active_catalog ON public.products (status, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products (archived_at DESC) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products (handle) WHERE is_deleted = FALSE;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. JWT Role Helpers & Security Claim Functions
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', 'customer');
$$;

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

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'accounts')
  );
$$;

-- Trigger to sync roles to auth metadata
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(NEW.role::text)
  )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
CREATE TRIGGER trg_sync_profile_role
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_role_to_auth();

-- Sync existing user roles
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
  COALESCE(u.raw_app_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(p.role::text)
)
FROM public.profiles p
WHERE u.id = p.id AND (u.raw_app_meta_data->>'role' IS DISTINCT FROM p.role::text);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. Row Level Security Policies
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_devices ENABLE ROW LEVEL SECURITY;

-- Products Policies
DROP POLICY IF EXISTS "Public can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS rls_products_public_read ON public.products;
DROP POLICY IF EXISTS rls_products_admin_read ON public.products;
DROP POLICY IF EXISTS rls_products_admin_write ON public.products;

CREATE POLICY rls_products_public_read ON public.products FOR SELECT USING (is_deleted = FALSE AND status = 'active');
CREATE POLICY rls_products_admin_read ON public.products FOR SELECT USING (public.is_manager_or_admin());
CREATE POLICY rls_products_admin_write ON public.products FOR ALL USING (public.is_manager_or_admin());

-- Profiles Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Orders Policies
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage orders" ON public.orders;

CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (customer_id = auth.uid());
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Quotes Policies
DROP POLICY IF EXISTS "Users can read own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Admins can manage quotes" ON public.quotes;

CREATE POLICY "Users can read own quotes" ON public.quotes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage quotes" ON public.quotes FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Innovation Content Policies
DROP POLICY IF EXISTS innovation_modes_read ON public.innovation_modes;
DROP POLICY IF EXISTS innovation_devices_read ON public.innovation_devices;
DROP POLICY IF EXISTS innovation_modes_admin_write ON public.innovation_modes;
DROP POLICY IF EXISTS innovation_devices_admin_write ON public.innovation_devices;

CREATE POLICY innovation_modes_read ON public.innovation_modes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY innovation_devices_read ON public.innovation_devices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY innovation_modes_admin_write ON public.innovation_modes FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY innovation_devices_admin_write ON public.innovation_devices FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Analytics & Security Policies (Claims based)
DROP POLICY IF EXISTS analytics_insert_auth ON public.analytics_events;
DROP POLICY IF EXISTS analytics_select_admin ON public.analytics_events;
DROP POLICY IF EXISTS leads_insert_auth ON public.leads;
DROP POLICY IF EXISTS leads_select_admin ON public.leads;
DROP POLICY IF EXISTS custom_setup_variables_read ON public.custom_setup_variables;
DROP POLICY IF EXISTS custom_setup_variables_admin_insert ON public.custom_setup_variables;
DROP POLICY IF EXISTS custom_setup_variables_admin_update ON public.custom_setup_variables;
DROP POLICY IF EXISTS custom_setup_variables_admin_delete ON public.custom_setup_variables;
DROP POLICY IF EXISTS security_audit_log_admin_only ON public.security_audit_log;
DROP POLICY IF EXISTS security_settings_admin_only ON public.security_settings;

CREATE POLICY analytics_insert_auth ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY analytics_select_admin ON public.analytics_events FOR SELECT TO authenticated USING (public.is_admin_user());
CREATE POLICY leads_insert_auth ON public.leads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY leads_select_admin ON public.leads FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE POLICY custom_setup_variables_read ON public.custom_setup_variables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY custom_setup_variables_admin_insert ON public.custom_setup_variables FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());
CREATE POLICY custom_setup_variables_admin_update ON public.custom_setup_variables FOR UPDATE TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY custom_setup_variables_admin_delete ON public.custom_setup_variables FOR DELETE TO authenticated USING (public.is_admin_user());

CREATE POLICY security_audit_log_admin_only ON public.security_audit_log FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
CREATE POLICY security_settings_admin_only ON public.security_settings FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Storage Bucket Policies
DROP POLICY IF EXISTS "Hero banners are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Images are publicly accessible" ON storage.objects;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 6. Core Database Functions
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Soft Delete Product
CREATE OR REPLACE FUNCTION public.soft_delete_product(
  p_product_id   UUID,
  p_deleted_by   UUID,
  p_reason       TEXT DEFAULT 'Administrative removal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product RECORD;
BEGIN
  SELECT id, title, status, is_deleted
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  IF v_product.is_deleted THEN
    RAISE EXCEPTION 'Product % is already deleted', p_product_id;
  END IF;

  UPDATE public.products
  SET
    is_deleted     = TRUE,
    deleted_at     = NOW(),
    deleted_by     = p_deleted_by,
    status         = 'archived',
    archived_at    = NOW(),
    archived_by    = p_deleted_by,
    archive_reason = p_reason,
    updated_at     = NOW()
  WHERE id = p_product_id;

  BEGIN
    UPDATE public.product_variants
    SET
      status     = 'archived',
      updated_at = NOW()
    WHERE product_id = p_product_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'product_id',   p_product_id,
    'title',        v_product.title,
    'archived_at',  NOW(),
    'archived_by',  p_deleted_by,
    'reason',       p_reason
  );
END;
$$;

-- Restore Product
CREATE OR REPLACE FUNCTION public.restore_product(
  p_product_id  UUID,
  p_restored_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_product RECORD;
BEGIN
  SELECT id, title, is_deleted
    INTO v_product
    FROM public.products
   WHERE id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id;
  END IF;

  IF NOT v_product.is_deleted THEN
    RAISE EXCEPTION 'Product % is not deleted â€“ nothing to restore', p_product_id;
  END IF;

  UPDATE public.products
  SET
    is_deleted     = FALSE,
    deleted_at     = NULL,
    deleted_by     = NULL,
    status         = 'active',
    archived_at    = NULL,
    archived_by    = NULL,
    archive_reason = NULL,
    updated_at     = NOW(),
    updated_by     = p_restored_by
  WHERE id = p_product_id;

  BEGIN
    UPDATE public.product_variants
    SET
      status     = 'active',
      updated_at = NOW()
    WHERE product_id = p_product_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'product_id',  p_product_id,
    'title',       v_product.title,
    'restored_at', NOW()
  );
END;
$$;

-- Record Atomic Stock Movement
CREATE OR REPLACE FUNCTION public.record_atomic_stock_movement(
  p_product_id     UUID,
  p_movement_type  TEXT,
  p_quantity       INTEGER,
  p_reference_id   TEXT    DEFAULT NULL,
  p_reference_type TEXT    DEFAULT 'manual',
  p_notes          TEXT    DEFAULT NULL,
  p_allow_negative BOOLEAN DEFAULT FALSE,
  p_created_by     UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_qty  INTEGER;
  v_min_stock    INTEGER;
  v_new_qty      INTEGER;
  v_new_status   TEXT;
  v_movement_id  UUID;
  v_inbound      TEXT[] := ARRAY['purchase_receipt', 'return'];
  v_outbound     TEXT[] := ARRAY['walk_in_sale', 'online_sale'];
BEGIN
  SELECT COALESCE(stock_quantity, 0), COALESCE(min_stock_level, 5)
    INTO v_current_qty, v_min_stock
    FROM public.products
    WHERE id = p_product_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id USING ERRCODE = 'P0002';
  END IF;

  IF p_movement_type = ANY(v_inbound) THEN
    v_new_qty := v_current_qty + p_quantity;
  ELSIF p_movement_type = ANY(v_outbound) THEN
    v_new_qty := v_current_qty - p_quantity;
    IF v_new_qty < 0 AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'Insufficient stock: current=%, requested=%, product=%', v_current_qty, p_quantity, p_product_id USING ERRCODE = 'P0001';
    END IF;
  ELSIF p_movement_type = 'adjustment' THEN
    v_new_qty := p_quantity;
  ELSE
    v_new_qty := v_current_qty;
  END IF;

  v_new_status := CASE
    WHEN v_new_qty <= 0            THEN 'out_of_stock'
    WHEN v_new_qty <= v_min_stock  THEN 'low_stock'
    ELSE 'in_stock'
  END;

  UPDATE public.products
  SET stock_quantity = v_new_qty, stock_status = v_new_status, updated_at = NOW()
  WHERE id = p_product_id;

  BEGIN
    UPDATE public.product_variants
    SET inventory_quantity = v_new_qty, updated_at = NOW()
    WHERE product_id = p_product_id AND status = 'active';
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity_delta, quantity_before, quantity_after,
    reference_id, reference_type, notes, created_by
  ) VALUES (
    p_product_id, p_movement_type, p_quantity, v_current_qty, v_new_qty,
    p_reference_id, p_reference_type, COALESCE(p_notes, p_movement_type || ' via system'),
    COALESCE(p_created_by, auth.uid())
  ) RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'movement_id',     v_movement_id,
    'quantity_before', v_current_qty,
    'quantity_after',  v_new_qty,
    'delta',           v_new_qty - v_current_qty,
    'stock_status',    v_new_status
  );
END;
$$;

-- Allocate Serial Inventory
CREATE OR REPLACE FUNCTION public.allocate_serial_inventory_atomic(
  p_order_id          UUID,
  p_product_id        UUID,
  p_quantity          INTEGER,
  p_requested_serials TEXT[] DEFAULT NULL
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_available_serials TEXT[];
  v_allocated_serials TEXT[];
  v_compulsory_serials BOOLEAN;
  v_current_stock     INTEGER;
  v_new_stock         INTEGER;
  v_notes             TEXT;
BEGIN
  SELECT stock, serial_numbers
    INTO v_current_stock, v_available_serials
    FROM public.inventory
   WHERE product_id = p_product_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory record for product ID % not found.', p_product_id USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(is_serial_number_compulsory, FALSE)
    INTO v_compulsory_serials
    FROM public.products
   WHERE id = p_product_id;

  IF v_current_stock < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock. Requested: %, Available: %', p_quantity, v_current_stock USING ERRCODE = 'P0001';
  END IF;

  IF v_compulsory_serials OR (p_requested_serials IS NOT NULL AND array_length(p_requested_serials, 1) > 0) THEN
    IF p_requested_serials IS NOT NULL AND array_length(p_requested_serials, 1) > 0 THEN
      IF array_length(p_requested_serials, 1) != p_quantity THEN
        RAISE EXCEPTION 'Allocation mismatch: Quantity requested (%) does not match number of serials specified (%).', p_quantity, array_length(p_requested_serials, 1) USING ERRCODE = 'P0003';
      END IF;

      IF NOT (p_requested_serials <@ v_available_serials) THEN
        RAISE EXCEPTION 'Invalid serial allocation: One or more requested serial numbers are not available in current inventory.' USING ERRCODE = 'P0004';
      END IF;

      v_allocated_serials := p_requested_serials;
    ELSE
      IF array_length(v_available_serials, 1) IS NULL OR array_length(v_available_serials, 1) < p_quantity THEN
        RAISE EXCEPTION 'Serial number compilation error: COMPULSORY serial setting is active, but only % serials exist for product ID %.', COALESCE(array_length(v_available_serials, 1), 0), p_product_id USING ERRCODE = 'P0005';
      END IF;

      v_allocated_serials := v_available_serials[1:p_quantity];
    END IF;

    SELECT ARRAY(
      SELECT unnest(v_available_serials)
      EXCEPT ALL
      SELECT unnest(v_allocated_serials)
    ) INTO v_available_serials;
  ELSE
    v_allocated_serials := ARRAY[]::TEXT[];
  END IF;

  v_new_stock := v_current_stock - p_quantity;
  
  UPDATE public.inventory SET stock = v_new_stock, serial_numbers = v_available_serials, updated_at = NOW() WHERE product_id = p_product_id;
  UPDATE public.products SET stock_quantity = v_new_stock, stock_status = CASE WHEN v_new_stock <= 0 THEN 'out_of_stock' WHEN v_new_stock <= COALESCE(min_stock_level, 5) THEN 'low_stock' ELSE 'in_stock' END, updated_at = NOW() WHERE id = p_product_id;

  v_notes := 'Allocated serials: ' || array_to_string(v_allocated_serials, ', ');
  
  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity_delta, quantity_before, quantity_after, reference_id, reference_type, notes, created_at
  ) VALUES (
    p_product_id, 'online_sale', p_quantity, v_current_stock, v_new_stock, p_order_id::TEXT, 'sales_order', v_notes, NOW()
  );

  RETURN v_allocated_serials;
END;
$$;

-- Atomic Order Checkout RPC
CREATE OR REPLACE FUNCTION public.allocate_order_inventory_atomic(
  p_customer_name     TEXT,
  p_customer_id       UUID,
  p_customer_email    TEXT,
  p_customer_phone    TEXT,
  p_delivery_address  TEXT,
  p_notes             TEXT,
  p_payment_method    TEXT,
  p_subtotal          NUMERIC,
  p_gst_amount        NUMERIC,
  p_total             NUMERIC,
  p_discount_amount   NUMERIC,
  p_shipping_amount   NUMERIC,
  p_payment_status    TEXT,
  p_order_type        TEXT,
  p_items             JSONB,
  p_agent_id          UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item            RECORD;
  v_order_id        UUID;
  v_created_order   JSONB;
  v_order_items_val JSONB;
BEGIN
  PERFORM 1 FROM public.products
   WHERE id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_items))
   ORDER BY id FOR UPDATE;

  FOR v_item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS quantity, (value->>'name')::text AS name FROM jsonb_array_elements(p_items) LOOP
    DECLARE
      v_stock_quantity INTEGER;
    BEGIN
      SELECT stock_quantity INTO v_stock_quantity FROM public.products WHERE id = v_item.id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Product % not found', v_item.id USING ERRCODE = 'P0002';
      END IF;
      IF COALESCE(v_stock_quantity, 0) < v_item.quantity THEN
        RAISE EXCEPTION 'Insufficient stock: current=%, requested=%, product=%', COALESCE(v_stock_quantity, 0), v_item.quantity, v_item.name USING ERRCODE = 'P0001';
      END IF;
    END;
  END LOOP;

  v_order_id := gen_random_uuid();

  FOR v_item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS quantity FROM jsonb_array_elements(p_items) LOOP
    PERFORM public.record_atomic_stock_movement(
      v_item.id, 'online_sale', v_item.quantity, v_order_id::text, 'online_order', 'Atomic order checkout placement', false, p_customer_id
    );
  END LOOP;

  v_order_items_val := jsonb_build_object(
    'cart_items', p_items, 'customer_email', p_customer_email, 'customer_phone', p_customer_phone, 'delivery_address', p_delivery_address,
    'pickup_store', CASE WHEN p_order_type = 'Pickup' THEN p_delivery_address ELSE null END, 'payment_method', p_payment_method,
    'customer_notes', p_notes, 'agent_id', p_agent_id, 'otp_required', CASE WHEN p_agent_id IS NOT NULL THEN true ELSE false END
  );

  INSERT INTO public.orders (
    id, customer_name, customer_id, status, subtotal, gst_amount, total, type, items, delivery_address, notes, payment_method,
    customer_email, customer_phone, discount_amount, shipping_amount, payment_status, created_at
  ) VALUES (
    v_order_id, p_customer_name, p_customer_id, 'Pending', p_subtotal, p_gst_amount, p_total, p_order_type, v_order_items_val, p_delivery_address,
    p_notes, p_payment_method, p_customer_email, p_customer_phone, p_discount_amount, p_shipping_amount, p_payment_status, NOW()
  ) RETURNING jsonb_build_object(
    'id', id, 'customer_name', customer_name, 'customer_id', customer_id, 'status', status, 'subtotal', subtotal, 'gst_amount', gst_amount,
    'total', total, 'type', type, 'items', items, 'delivery_address', delivery_address, 'notes', notes, 'payment_method', payment_method,
    'customer_email', customer_email, 'customer_phone', customer_phone, 'discount_amount', discount_amount, 'shipping_amount', shipping_amount,
    'payment_status', payment_status, 'created_at', created_at
  ) INTO v_created_order;

  RETURN jsonb_build_object('success', true, 'order', v_created_order);
END;
$$;

-- Aggregate Top Products View aggregation
CREATE OR REPLACE FUNCTION public.get_top_products(p_start_date TIMESTAMPTZ, p_limit INTEGER)
RETURNS TABLE (resource_id TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT resource_id, COUNT(*) as count
  FROM public.analytics_events
  WHERE event_type = 'product_view' AND resource_id IS NOT NULL AND created_at >= p_start_date
  GROUP BY resource_id ORDER BY count DESC LIMIT p_limit;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 7. Media Gatekeeper Trigger & Logger Triggers
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE FUNCTION public.check_product_media_gatekeeper()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'active' AND (NEW.is_deleted = FALSE OR NEW.is_deleted IS NULL) THEN
    IF NEW.images IS NULL 
       OR array_length(NEW.images, 1) IS NULL 
       OR (array_length(NEW.images, 1) = 1 AND (NEW.images[1] IS NULL OR NEW.images[1] = '')) THEN
      
      RAISE EXCEPTION 'Product publication failed: A valid photo reference must exist in the images array before publishing.'
        USING ERRCODE = '45000';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_media_gatekeeper ON public.products;
CREATE TRIGGER trg_product_media_gatekeeper
  BEFORE INSERT OR UPDATE OF status, images ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.check_product_media_gatekeeper();

-- Compliance Log Trigger
CREATE OR REPLACE FUNCTION public.log_product_archive_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
    INSERT INTO public.product_archive_log (
      product_id, product_title, action, performed_by, reason, snapshot
    ) VALUES (
      NEW.id, COALESCE(NEW.title, NEW.name, 'Unknown'), CASE WHEN NEW.is_deleted THEN 'archived' ELSE 'restored' END,
      NEW.deleted_by, NEW.archive_reason, to_jsonb(NEW)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_archive_log ON public.products;
CREATE TRIGGER trg_product_archive_log
  AFTER UPDATE OF is_deleted ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.log_product_archive_change();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 8. Views (Security Invoker Compliant)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE OR REPLACE VIEW public.active_products_view WITH (security_invoker = true) AS
SELECT
  p.*,
  COALESCE(p.stock_quantity, 0)            AS effective_stock,
  CASE
    WHEN COALESCE(p.stock_quantity, 0) <= 0                       THEN 'out_of_stock'
    WHEN COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5) THEN 'low_stock'
    ELSE 'in_stock'
  END                                       AS computed_stock_status
FROM public.products p
WHERE p.is_deleted = FALSE AND p.status = 'active';

ALTER VIEW IF EXISTS public.product_analytics_view SET (security_invoker = on);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 9. Seed Defaults
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

INSERT INTO public.innovation_modes (
  id, key, label, sub, title, description, icon, rec_id, items, is_active, display_order
) VALUES
(
  '11111111-1111-1111-1111-111111111111', 'security', 'Fortress Mode', 'Security & Monitoring', 'Fortress Configuration',
  'A robust perimeter defense setup utilizing door sensors, motion detection, and automated alert lighting.',
  'Shield', 'SEC-01',
  '[{"icon":"DoorClosed","text":"Entry Sensors","accent":"text-violet-300"},{"icon":"Wifi","text":"Motion Detectors","accent":"text-violet-300"},{"icon":"Bell","text":"Smart Siren","accent":"text-violet-300"},{"icon":"Camera","text":"IP Cam Integration","accent":"text-violet-300"}]'::jsonb,
  true, 1
),
(
  '22222222-2222-2222-2222-222222222222', 'chill', 'Chill Ambience', 'Lighting & Comfort', 'Relaxation Protocol',
  'Automated mood lighting and climate control designed for evening downtime and media consumption.',
  'Speaker', 'RLX-05',
  '[{"icon":"Lightbulb","text":"RGB Ambient Light","accent":"text-cyan-300"},{"icon":"Cpu","text":"Automation Logic","accent":"text-cyan-300"},{"icon":"Speaker","text":"Audio Sync","accent":"text-cyan-300"},{"icon":"Zap","text":"Dimmer Switches","accent":"text-cyan-300"}]'::jsonb,
  true, 2
),
(
  '33333333-3333-3333-3333-333333333333', 'energy', 'Eco Saver', 'Automation & Efficiency', 'Eco-Efficiency Grid',
  'Optimize power usage with smart scheduling for heavy appliances and precise radar sensing.',
  'Leaf', 'ECO-99',
  '[{"icon":"Zap","text":"Heavy Duty Plugs","accent":"text-emerald-300"},{"icon":"Cpu","text":"Schedule Timers","accent":"text-emerald-300"},{"icon":"Leaf","text":"Usage Monitoring","accent":"text-emerald-300"},{"icon":"Wifi","text":"mmWave Radar","accent":"text-emerald-300"}]'::jsonb,
  true, 3
)
ON CONFLICT (key) DO UPDATE SET
  label = excluded.label, sub = excluded.sub, title = excluded.title, description = excluded.description,
  icon = excluded.icon, rec_id = excluded.rec_id, items = excluded.items, is_active = excluded.is_active,
  display_order = excluded.display_order, updated_at = NOW();

INSERT INTO public.innovation_devices (
  id, title, description, accent, icon, chips, is_active, display_order
) VALUES
(
  '44444444-4444-4444-4444-444444444444', 'Biometric Smart Lock Pro', 'Fingerprint â€¢ RFID â€¢ App Control', 'violet', 'Shield',
  '["1 Year Battery","AES-128 Enc","Remote Unlock","Tamper Alert"]'::jsonb, true, 1
),
(
  '55555555-5555-5555-5555-555555555555', 'mmWave Presence Sensor', 'Micro-Motion Breath Detection', 'cyan', 'Wifi',
  '["Sub-mm Accuracy","24/7 Powered","Light Sensor","Zigbee 3.0"]'::jsonb, true, 2
),
(
  '66666666-6666-6666-6666-666666666666', 'Neon Flex RGBIC', 'Addressable LED â€¢ Music Sync', 'amber', 'Lightbulb',
  '["16M Colors","Voice Control","IP67 Waterproof","Auto Schedule"]'::jsonb, true, 3
)
ON CONFLICT (id) DO UPDATE SET
  title = excluded.title, description = excluded.description, accent = excluded.accent, icon = excluded.icon,
  chips = excluded.chips, is_active = excluded.is_active, display_order = excluded.display_order, updated_at = NOW();

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 10. Strict Execution Permissions Lockdown
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

REVOKE EXECUTE ON FUNCTION public.sync_profile_role_to_auth() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_product_archive_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_order_inventory_atomic(text, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_atomic_stock_movement(uuid, text, integer, text, text, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.restore_product(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.soft_delete_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.allocate_serial_inventory_atomic(uuid, uuid, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_product_media_gatekeeper() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_top_products(timestamptz, integer) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_staff_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;

-- Discretionary cleanups
ALTER FUNCTION public.decrement_stock_with_serials SET search_path = '';
ALTER FUNCTION public.decrement_product_stock SET search_path = '';

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_contact_messages_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_page_content_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- Source: 20260604000500_services_icon_name.sql
-- ============================================================================

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


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. Ensure the services table exists (idempotent)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Add icon_name if the table already existed without it
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS icon_name TEXT;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Indexes for common query patterns
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE INDEX IF NOT EXISTS idx_services_is_active      ON public.services (is_active);
CREATE INDEX IF NOT EXISTS idx_services_category       ON public.services (category);
CREATE INDEX IF NOT EXISTS idx_services_display_order  ON public.services (display_order);

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. RLS
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. updated_at auto-update trigger (reuse shared helper if it exists)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- ============================================================================
-- Source: 20260604001000_faq_system.sql
-- ============================================================================

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

-- ============================================================================
-- Source: 20260604001500_database_fixes.sql
-- ============================================================================

-- ============================================================================
-- Migration: Database Security, Reliability, Integrity, and Performance Fixes
-- File:      20260604001500_database_fixes.sql
-- ============================================================================


-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 1. State Transition & Completion RPC Functions
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Transaction-safe Order Status Update
CREATE OR REPLACE FUNCTION public.update_order_status_v1(
  target_order_id UUID,
  new_status TEXT,
  new_payment_status TEXT,
  additional_data JSONB,
  p_pickup_code TEXT,
  p_processed_by UUID
)
RETURNS VOID AS $$
DECLARE
  v_key TEXT;
  v_val JSONB;
  v_current_status TEXT;
  v_current_payment_status TEXT;
  v_items_json JSONB;
  v_item RECORD;
BEGIN
  -- Acquire exclusive row lock on the target order to serialize transitions
  SELECT status, payment_status, items INTO v_current_status, v_current_payment_status, v_items_json
  FROM public.orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', target_order_id;
  END IF;

  -- Atomic transition safeguard: prevent changing completed/delivered/cancelled orders to active states
  IF v_current_status IN ('Cancelled', 'Rejected', 'Completed', 'Delivered') AND new_status NOT IN ('Cancelled', 'Rejected', 'Completed', 'Delivered') THEN
    RAISE EXCEPTION 'Cannot transition order % from terminal state (%) to %', target_order_id, v_current_status, new_status;
  END IF;

  -- Update orders table status and audit fields
  UPDATE public.orders
  SET
    status = new_status,
    payment_status = COALESCE(new_payment_status, payment_status),
    processed_by = p_processed_by,
    updated_at = NOW()
  WHERE id = target_order_id;

  -- Apply additional data keys if provided
  IF additional_data IS NOT NULL THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each(additional_data) LOOP
      IF v_key = 'cancellation_reason' THEN
        UPDATE public.orders SET cancellation_reason = v_val#>>'{}' WHERE id = target_order_id;
      ELSIF v_key = 'payment_reference' THEN
        UPDATE public.orders SET payment_reference = v_val#>>'{}' WHERE id = target_order_id;
      ELSIF v_key = 'notes' THEN
        UPDATE public.orders SET notes = v_val#>>'{}' WHERE id = target_order_id;
      ELSIF v_key = 'shipping_amount' THEN
        UPDATE public.orders SET shipping_amount = (v_val#>>'{}')::NUMERIC WHERE id = target_order_id;
      ELSIF v_key = 'discount_amount' THEN
        UPDATE public.orders SET discount_amount = (v_val#>>'{}')::NUMERIC WHERE id = target_order_id;
      END IF;
    END LOOP;
  END IF;

  -- If code is provided, set it
  IF p_pickup_code IS NOT NULL AND p_pickup_code <> '' THEN
    UPDATE public.orders SET pickup_code = p_pickup_code WHERE id = target_order_id;
  END IF;

  -- Handle cancellation auditing, stock release, and commission cancellation
  IF new_status IN ('Cancelled', 'Rejected') THEN
    UPDATE public.orders
    SET
      cancelled_at = NOW(),
      cancelled_by = p_processed_by
    WHERE id = target_order_id;

    -- Release allocated inventory stock if order is transition-to-cancelled
    IF v_current_status NOT IN ('Cancelled', 'Rejected') AND v_items_json IS NOT NULL THEN
      FOR v_item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS quantity FROM jsonb_array_elements(v_items_json->'cart_items') LOOP
        PERFORM public.record_atomic_stock_movement(
          v_item.id,
          'return',
          v_item.quantity,
          target_order_id::TEXT,
          'online_order',
          'Reverted stock due to order cancellation',
          true,
          p_processed_by
        );
      END LOOP;
    END IF;

    -- Automatically cancel associated sales commissions
    UPDATE public.sales_agent_commissions
    SET status = 'cancelled'
    WHERE order_id = target_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Transaction-safe Service Completion
CREATE OR REPLACE FUNCTION public.complete_service_ticket_v1(
  p_ticket_id          UUID,
  p_engineer_notes     TEXT,
  p_service_charge     NUMERIC,
  p_actual_duration    INTEGER,
  p_photos             TEXT[],
  p_parts_used         JSONB -- Array of parts
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part RECORD;
  v_total_parts_cost NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_current_status TEXT;
BEGIN
  -- Acquire exclusive row lock on the service ticket
  SELECT status INTO v_current_status
  FROM public.service_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket % not found', p_ticket_id;
  END IF;

  IF v_current_status = 'completed' THEN
    RAISE EXCEPTION 'Service ticket % is already completed', p_ticket_id;
  END IF;

  -- 1. Insert parts if provided
  IF p_parts_used IS NOT NULL AND jsonb_array_length(p_parts_used) > 0 THEN
    FOR v_part IN SELECT * FROM jsonb_to_recordset(p_parts_used) AS x(part_name TEXT, quantity INTEGER, unit_cost NUMERIC, warranty_days INTEGER) LOOP
      INSERT INTO public.service_parts (
        ticket_id, part_name, quantity, unit_cost, warranty_days
      ) VALUES (
        p_ticket_id, v_part.part_name, v_part.quantity, v_part.unit_cost, COALESCE(v_part.warranty_days, 0)
      );
      v_total_parts_cost := v_total_parts_cost + (v_part.quantity * v_part.unit_cost);
    END LOOP;
  END IF;

  v_total_cost := COALESCE(p_service_charge, 0) + v_total_parts_cost;

  -- 2. Update service ticket
  UPDATE public.service_tickets
  SET
    status = 'completed',
    completed_at = NOW(),
    engineer_notes = p_engineer_notes,
    service_charge = p_service_charge,
    parts_cost = v_total_parts_cost,
    total_cost = v_total_cost,
    actual_duration = p_actual_duration,
    photos = p_photos,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  RETURN v_total_cost;
END;
$$;

-- Restrict public execution on RPCs
REVOKE EXECUTE ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) TO authenticated;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 2. Schema Enforcements & Type Constraints
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Check Constraint for valid Lucide icons in services
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS chk_services_icon_name;
ALTER TABLE public.services ADD CONSTRAINT chk_services_icon_name 
  CHECK (icon_name IS NULL OR icon_name IN ('Wrench', 'Shield', 'Truck', 'HeadphonesIcon', 'RefreshCw', 'Award', 'Cctv', 'Cpu', 'Code'));

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 3. Cascade-Deletion Constraints
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- For order_items
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- For order_otp_verifications
ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS fk_order;
ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS fk_order_otp;
ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS order_otp_verifications_order_id_fkey;
ALTER TABLE public.order_otp_verifications ADD CONSTRAINT fk_order_otp FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- For sales_agent_commissions
ALTER TABLE public.sales_agent_commissions DROP CONSTRAINT IF EXISTS sales_agent_commissions_order_id_fkey;
ALTER TABLE public.sales_agent_commissions DROP CONSTRAINT IF EXISTS fk_sales_agent_commissions_order;
ALTER TABLE public.sales_agent_commissions ADD CONSTRAINT fk_sales_agent_commissions_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 4. Lookup Optimization Indexes
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Safe Indexing for otp_verifications phone/email
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'phone') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON public.otp_verifications(phone);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'email') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON public.otp_verifications(email);
    END IF;
  END IF;
END;
$$;

-- Safe Indexing for otp_codes phone/email
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_codes') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_codes' AND column_name = 'phone') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_codes_phone ON public.otp_codes(phone);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_codes' AND column_name = 'email') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON public.otp_codes(email);
    END IF;
  END IF;
END;
$$;

-- Safe Indexing for order_otp_verifications customer_phone
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_otp_verifications' AND column_name = 'customer_phone') THEN
      CREATE INDEX IF NOT EXISTS idx_order_otp_verifications_phone ON public.order_otp_verifications(customer_phone);
    END IF;
  END IF;
END;
$$;

-- Create index on whatsapp_logs phone/mobile if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_logs') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_logs' AND column_name = 'phone') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_phone ON public.whatsapp_logs(phone)';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'whatsapp_logs' AND column_name = 'mobile') THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_mobile ON public.whatsapp_logs(mobile)';
    END IF;
  END IF;
END;
$$;

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- 5. Logging and Data Retention pg_cron Rotation Job
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Create function to prune old webhook_events, whatsapp_logs, and expired OTPs
CREATE OR REPLACE FUNCTION public.prune_old_logs()
RETURNS void AS $$
BEGIN
  -- Prune old webhooks
  DELETE FROM public.webhook_events
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Prune whatsapp_logs if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_logs') THEN
    EXECUTE 'DELETE FROM public.whatsapp_logs WHERE created_at < NOW() - INTERVAL ''30 days''';
  END IF;
  
  -- Prune old unverified/expired OTP codes
  DELETE FROM public.otp_codes
  WHERE expires_at < NOW() - INTERVAL '30 days';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_verifications') THEN
    EXECUTE 'DELETE FROM public.otp_verifications WHERE expires_at < NOW() - INTERVAL ''30 days''';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_otp_verifications') THEN
    EXECUTE 'DELETE FROM public.order_otp_verifications WHERE expires_at < NOW() - INTERVAL ''30 days''';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the pg_cron daily cleanup job
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('prune-logs-daily');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    
    PERFORM cron.schedule(
      'prune-logs-daily',
      '0 0 * * *',
      'SELECT public.prune_old_logs()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule pg_cron job: %', SQLERRM;
END;
$$;


-- ============================================================================
-- Source: 20260605130000_superadmin_rls_fixes.sql
-- ============================================================================

-- Migration: Superadmin RLS & Helper Updates
-- Date:      2026-06-05
-- Purpose:   Updates RLS checks and helpers to support the 'superadmin' role,
--            and restricts security tables exclusively to 'superadmin' users.

-- 1. Helper to fetch role from JWT app_metadata
CREATE OR REPLACE FUNCTION public.get_jwt_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    CASE 
      WHEN (auth.jwt() -> 'app_metadata' ->> 'role') IN ('superadmin', 'super-admin', 'super admin', 'super_admin') THEN 'superadmin'
      ELSE auth.jwt() -> 'app_metadata' ->> 'role'
    END,
    'customer'
  );
$$;

-- 2. Helper to verify if user is superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'superadmin'
  );
$$;

-- 3. Redefine is_admin_user to include superadmin
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
      AND role IN ('admin', 'superadmin')
  );
$$;

-- 4. Redefine is_manager_or_admin to include superadmin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'superadmin')
  );
$$;

-- 5. Redefine is_staff_member to include superadmin
CREATE OR REPLACE FUNCTION public.is_staff_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager', 'sales', 'accounts', 'superadmin')
  );
$$;

-- 6. Restrict security_settings & security_audit_log tables strictly to superadmin
DROP POLICY IF EXISTS security_audit_log_admin_only ON public.security_audit_log;
DROP POLICY IF EXISTS security_settings_admin_only ON public.security_settings;

CREATE POLICY security_audit_log_superadmin_only ON public.security_audit_log FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());
CREATE POLICY security_settings_superadmin_only ON public.security_settings FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());

-- ============================================================================
-- Source: 20260605140000_seed_ai_prompts.sql
-- ============================================================================

-- Migration: Seed AI Prompt Default Configuration
-- Date: 2026-06-05
-- Purpose: Seeds the default prompt configurations into the settings table so that they are no longer hardcoded in Next.js codebase.

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

WITH seed_settings(key, value_text, description, updated_at) AS (
  VALUES
(
  'ai_prompt_research',
  'You are a knowledgeable, professional AI research assistant. Your goal is to provide comprehensive, accurate, and actionable information in a friendly, conversational tone. Focus on being helpful and informative rather than sales-oriented.

**IMPORTANT:** Completely exclude any pricing information, costs, discounts, budgets, financial terms, or payment details. If external sources contain prices, ignore them. Do not use terms like "affordable," "expensive," "budget," "cost-effective," or similar financial comparisons.

---

**User Query:** {query}

**Available Product Information:**
{productContext}

**External Research Sources:**
{sourceContext}

---

**Structure your response with these sections:**

1. **Overview**
   - What is this product/technology? Main purpose and primary use cases
   - Key characteristics and why it matters
   - General market availability and popularity
   - If no products found, provide general information about the topic

2. **Features & Specifications**
   - Main features and technical specifications (if product data available)
   - What makes this different from generic alternatives
   - Performance characteristics and quality indicators
   - Standards or certifications (if applicable)

3. **Typical Use Cases**
   - Who uses this and why
   - Specific scenarios where it excels
   - Common applications and real-world examples
   - Best-fit situations and ideal conditions

4. **Comparison with Alternatives**
   - How does this compare to similar products/solutions?
   - What are the trade-offs?
   - When to choose one over another
   - Competitor landscape (if multiple similar options exist)

5. **Key Considerations Before Choosing**
   - Important factors to evaluate
   - Common mistakes or misconceptions
   - Maintenance, support, or compatibility requirements
   - Environmental or operational factors

6. **Recommended Next Steps**
   - What specific information should users research further?
   - Questions to ask suppliers/vendors
   - How to evaluate if this is right for your needs
   - Resources for deeper learning

---

**Formatting Guidelines:**
- Use clear, concise language with short paragraphs
- Use bullet points for lists when appropriate
- Use **bold** for key terms and concepts
- Keep sentences direct and scannable
- If information is uncertain or not available, say "Specific details are not available, but typically..."
- Always be honest about limitations in available data',
  'AI Research Assistant Prompt',
  NOW()
),
(
  'ai_prompt_product_details',
  'You extract structured product data for TecBunny staff.
Use the provided product page content to fill product details.
Return JSON only. Do not include markdown or explanations.
If a field is unknown, use null. Do not invent HSN codes, barcodes, GST, or prices.
Prefer concise ecommerce-ready descriptions and Indian retail wording when relevant.

Schema:
{schema}

Current product data from the form:
{existingData}

Fetched page metadata:
{pageMetadata}

Fetched page text excerpt:
{bodyText}',
  'Product Details Extractor Prompt',
  NOW()
),
(
  'ai_prompt_generate_description',
  'You are an expert Indian e-commerce product copywriter specialising in IT hardware and electronics.

PRODUCT DETAILS:
  Title:        {title}
  Category:     {category}
  Brand:        {brand}
  Model Number: {model_number}
  {featureBlock}
  {hsnNote}

TASK:
Generate a beautifully styled product description as a self-contained HTML fragment (NO <html>, <head>, or <body> tags).

STRICT FORMATTING RULES â€” follow exactly, no deviation:

1. HEADER SECTION:
   <h2 style="color: {accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.4rem; margin-bottom: 0.5rem; border-bottom: 2px solid {accent_color}; padding-bottom: 0.4rem;">
     [Product Title Here]
   </h2>

2. INTRO PARAGRAPH:
   <p style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.95rem; line-height: 1.7; color: #333; margin-bottom: 1rem;">
     [2-3 sentence punchy overview of what the product does and who it is for]
   </p>

3. FEATURES SECTION (REQUIRED â€“ use exactly this structure):
   <h3 style="color: {accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.1rem; margin-bottom: 0.5rem;">
     Key Features
   </h3>
   <ul style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.9rem; line-height: 1.8; color: #444; padding-left: 1.2rem; margin-bottom: 1.2rem;">
     <li><strong>[Feature label]:</strong> [Feature detail]</li>
     <!-- Minimum 5 feature bullets, maximum 8 -->
   </ul>

4. APPLICATIONS / USE CASES (optional but preferred):
   <h3 style="color: {accent_color}; font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 1.1rem; margin-bottom: 0.5rem;">
     Ideal Applications
   </h3>
   <ul style="font-family: ''Inter'', ''Segoe UI'', sans-serif; font-size: 0.9rem; line-height: 1.8; color: #444; padding-left: 1.2rem; margin-bottom: 1.2rem;">
     <li>[Use case 1]</li>
     <li>[Use case 2]</li>
   </ul>

5. SUMMARY CARD (REQUIRED â€“ place at the bottom):
   <div class="summary" style="background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border-left: 4px solid #28a745; border-radius: 6px; padding: 1rem 1.2rem; margin-top: 1.2rem; font-family: ''Inter'', ''Segoe UI'', sans-serif;">
     <strong style="color: #28a745; font-size: 1rem;">âœ… Why Choose This Product?</strong>
     <p style="font-size: 0.88rem; color: #2e7d32; margin-top: 0.4rem; line-height: 1.6;">
       [2-sentence compelling closing pitch]
     </p>
     {hsnSummaryNote}
   </div>

SQL-SAFETY RULE â€” CRITICAL:
All apostrophes in text MUST be escaped as double single-quotes (example: doesn''t, India''s, it''s).
This prevents SQL string termination failures in raw INSERT statements.
Never use a single apostrophe inside any text string in the output.

OUTPUT: Return ONLY the HTML fragment. No markdown, no fences, no preamble.',
  'HTML Description Copywriter Prompt',
  NOW()
),
(
  'ai_prompt_ai_query',
  'You are the TecBunny admin assistant. Provide concise, factual responses. If data is missing, say so.

User query: {rawQuery}

Data:
{contextData}

Provide a short response using only the data above.',
  'Root Factual Query Assistant Prompt',
  NOW()
),
(
  'ai_prompt_product_description',
  'You are a product copywriter for TecBunny Solutions.
Write a clear, persuasive product description for the following product.
Keep it concise, structured, and avoid markdown bullets unless necessary.
Tone: {tone}.
Length: {length}.

Product data:
{productData}',
  'E-commerce Brief Copywriter Prompt',
  NOW()
),
(
  'ai_prompt_ai_add',
  'You are a precise product data extraction engine for an Indian IT hardware e-commerce system.

{imageNote}
INPUT (raw supplier text / model token):
"""
{rawInput}
"""

TASK: Extract structured product data and return ONLY valid JSON. No markdown fences, no explanation.

REQUIRED OUTPUT SCHEMA (all fields optional except noted):
{
  "title": "string â€“ clean marketing title (REQUIRED)",
  "name": "string â€“ same as title or shorter SKU name",
  "handle": "string â€“ url-slug with hyphens only, lowercase, max 50 chars",
  "model_number": "string â€“ exact model token if present (e.g. CP-UNC-DA21L3C-LQ-0360)",
  "vendor": "string â€“ brand or manufacturer name",
  "category": "string â€“ one of: Networking, Cables, Adapters, UPS, Storage, Accessories, Servers, Printers, General (REQUIRED â€“ default General)",
  "product_type": "string â€“ same as category or a sub-type",
  "description": "string â€“ 1-2 sentence plain-text description",
  "hsn_code": "string â€“ HSN/SAC code if determinable",
  "tags": ["array", "of", "lowercase", "keyword", "strings"],
  "price": number (INR, dealer price before markup â€“ 0 if unknown),
  "mrp": number (INR, retail price â€“ 0 if unknown),
  "stock_quantity": number (default 0),
  "status": "active",
  "gst_rate": number (GST percentage: 5, 12, 18, or 28 â€“ default 18)
}

RULES:
- Output ONLY the JSON object. No extra text.
- If a field cannot be determined, omit it (do NOT output null for strings).',
  'Raw Product Ingestion Engine Prompt',
  NOW()
)
)
INSERT INTO public.settings (key, value, description, updated_at)
SELECT key::text, to_json(value_text::text), description::text, updated_at
FROM seed_settings
ON CONFLICT (key)
DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- Source: 20260606000000_perf_indexes.sql
-- ============================================================================

-- Migration: Create lookup performance indexes to eliminate full-table scans
-- Date: 2026-06-06

DO $$
BEGIN
  -- 1. Index on otp_verifications(code) for faster code validations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'code') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_code ON public.otp_verifications(code);
    END IF;
  END IF;

  -- 2. Index on order_otp_verifications(otp_code) for atomic OTP checks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_otp_verifications') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_otp_verifications' AND column_name = 'otp_code') THEN
      CREATE INDEX IF NOT EXISTS idx_order_otp_verifications_otp_code ON public.order_otp_verifications(otp_code);
    END IF;
  END IF;

  -- 3. Indexes on webhook_events for audit logging and pruning operations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'event_type') THEN
      CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'webhook_events' AND column_name = 'created_at') THEN
      CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);
    END IF;
  END IF;

  -- 4. Index on payment_transactions(order_id) (conditional fallback if table is present)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payment_transactions') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'order_id') THEN
      CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- Source: 20260606001000_tax_and_policies.sql
-- ============================================================================

-- Migration: Create tax_rates, hsn_codes, and policies schemas and defaults
-- Date: 2026-06-06


-- 1. Create tax_rates table
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create hsn_codes table
CREATE TABLE IF NOT EXISTS public.hsn_codes (
  code VARCHAR(20) PRIMARY KEY,
  tax_rate_id INTEGER REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create policies table
CREATE TABLE IF NOT EXISTS public.policies (
  key VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS and create standard select policies
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_tax_rates_public_select ON public.tax_rates;
CREATE POLICY rls_tax_rates_public_select ON public.tax_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_hsn_codes_public_select ON public.hsn_codes;
CREATE POLICY rls_hsn_codes_public_select ON public.hsn_codes FOR SELECT USING (true);

DROP POLICY IF EXISTS rls_policies_public_select ON public.policies;
CREATE POLICY rls_policies_public_select ON public.policies FOR SELECT USING (is_published = true);

-- Add manager/admin manage policies
DROP POLICY IF EXISTS rls_tax_rates_admin_manage ON public.tax_rates;
CREATE POLICY rls_tax_rates_admin_manage ON public.tax_rates FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS rls_hsn_codes_admin_manage ON public.hsn_codes;
CREATE POLICY rls_hsn_codes_admin_manage ON public.hsn_codes FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS rls_policies_admin_manage ON public.policies;
CREATE POLICY rls_policies_admin_manage ON public.policies FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 5. Seed tax_rates
INSERT INTO public.tax_rates (name, rate, is_default, description)
VALUES
  ('GST 5%', 5.00, false, 'Standard 5% GST rate'),
  ('GST 12%', 12.00, false, 'Standard 12% GST rate'),
  ('GST 18%', 18.00, true, 'Standard 18% GST rate'),
  ('GST 28%', 28.00, false, 'Standard 28% GST rate')
ON CONFLICT (name) DO UPDATE SET
  rate = EXCLUDED.rate,
  is_default = EXCLUDED.is_default,
  description = EXCLUDED.description;

-- 6. Seed default HSN codes
INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8471', id, 18.00, 'Computers and automatic data processing units' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8504', id, 18.00, 'Electrical transformers, static converters and inductors' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.hsn_codes (code, tax_rate_id, gst_rate, description)
SELECT '8544', id, 18.00, 'Insulated wire, cable and other conductors' FROM public.tax_rates WHERE name = 'GST 18%'
ON CONFLICT (code) DO NOTHING;

-- 7. Seed default settings keys
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

WITH seed_settings(key, value_text, description, updated_at) AS (
  VALUES
  ('phone', '+91 96041 36010', 'Primary Support Phone Number', NOW()),
  ('support_email', 'support@tecbunny.com', 'Primary Support Email Address', NOW()),
  ('whatsapp_template_string', 'https://wa.me/919604136010', 'WhatsApp Contact Quick Link', NOW()),
  ('facebook_pixel_id', '1234567890', 'Facebook Tracking Pixel ID', NOW()),
  ('default_gst_rate', '18.00', 'Standard fallback GST percentage rate', NOW())
)
INSERT INTO public.settings (key, value, description, updated_at)
SELECT key::text, to_json(value_text::text), description::text, updated_at
FROM seed_settings
ON CONFLICT (key) DO NOTHING;

-- 8. Populate policies table from page_content table if it exists
DO $$
DECLARE
  key_expr TEXT;
  title_expr TEXT;
  content_expr TEXT;
  status_expr TEXT;
  created_expr TEXT;
  updated_expr TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'page_content') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'page_key') THEN
      key_expr := 'page_key';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'key') THEN
      key_expr := '"key"';
    ELSE
      key_expr := NULL;
    END IF;

    IF key_expr IS NOT NULL THEN
      title_expr := CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'title')
          THEN 'COALESCE(title::text, ' || key_expr || '::text)'
        ELSE key_expr || '::text'
      END;

      content_expr := CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'content')
          THEN 'to_jsonb(content)'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'data')
          THEN 'to_jsonb(data)'
        ELSE '''{}''::jsonb'
      END;

      status_expr := CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'status')
          THEN 'CASE WHEN COALESCE(status::text, ''published'') = ''published'' THEN true ELSE false END'
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'is_active')
          THEN 'COALESCE(is_active, false)'
        ELSE 'true'
      END;

      created_expr := CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'created_at')
          THEN 'COALESCE(created_at, NOW())'
        ELSE 'NOW()'
      END;

      updated_expr := CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'page_content' AND column_name = 'updated_at')
          THEN 'COALESCE(updated_at, NOW())'
        ELSE 'NOW()'
      END;

      EXECUTE '
        INSERT INTO public.policies (key, title, content, is_published, created_at, updated_at)
        SELECT
          ' || key_expr || '::text,
          ' || title_expr || ',
          ' || content_expr || ',
          ' || status_expr || ',
          ' || created_expr || ',
          ' || updated_expr || '
        FROM public.page_content
        WHERE ' || key_expr || '::text IN (''privacy_policy'', ''terms_of_service'', ''refund_cancellation_policy'', ''shipping_policy'', ''return_policy'')
        ON CONFLICT (key) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          is_published = EXCLUDED.is_published,
          updated_at = EXCLUDED.updated_at';
    END IF;
  END IF;
END $$;


-- ============================================================================
-- Source: 20260606002000_product_ai_tax_classification.sql
-- ============================================================================

-- Migration: Add AI-assisted product tax classification columns
-- Date: 2026-06-06


ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS hsn_code TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tax_ai_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS tax_ai_justification TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_model TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_classified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_ai_requested_by UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_at TIMESTAMPTZ;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_hsn_code_8_digit_chk,
  ADD CONSTRAINT products_hsn_code_8_digit_chk
    CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{8}$') NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_gst_rate_standard_tier_chk,
  ADD CONSTRAINT products_gst_rate_standard_tier_chk
    CHECK (gst_rate IS NULL OR gst_rate IN (0, 5, 12, 18, 28)) NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_tax_ai_confidence_range_chk,
  ADD CONSTRAINT products_tax_ai_confidence_range_chk
    CHECK (tax_ai_confidence IS NULL OR (tax_ai_confidence >= 0 AND tax_ai_confidence <= 1)) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products (hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON public.products (gst_rate);
CREATE INDEX IF NOT EXISTS idx_products_tax_ai_review ON public.products (tax_ai_reviewed, tax_ai_classified_at DESC);


COMMIT;
