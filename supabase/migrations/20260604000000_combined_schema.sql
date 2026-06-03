-- ============================================================================
-- Migration: Unified E-Commerce Database Schema
-- File:      20260604000000_combined_schema.sql
-- Purpose:   Consolidates all previous migrations (quotes, innovation content,
--            security fixes, RLS recursion fixes, soft delete, atomic checkout,
--            media gatekeepers, serial inventory allocations, and tiered pricing)
--            into a single clean and optimized initial script.
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Custom Enums & Types
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Table Creation (New Tables Added via Migrations)
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Core Table Enhancements (Altering existing tables)
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 4. JWT Role Helpers & Security Claim Functions
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Row Level Security Policies
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Core Database Functions
-- ────────────────────────────────────────────────────────────────────────────

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
    RAISE EXCEPTION 'Product % is not deleted – nothing to restore', p_product_id;
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

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Media Gatekeeper Trigger & Logger Triggers
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Views (Security Invoker Compliant)
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Seed Defaults
-- ────────────────────────────────────────────────────────────────────────────

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
  '44444444-4444-4444-4444-444444444444', 'Biometric Smart Lock Pro', 'Fingerprint • RFID • App Control', 'violet', 'Shield',
  '["1 Year Battery","AES-128 Enc","Remote Unlock","Tamper Alert"]'::jsonb, true, 1
),
(
  '55555555-5555-5555-5555-555555555555', 'mmWave Presence Sensor', 'Micro-Motion Breath Detection', 'cyan', 'Wifi',
  '["Sub-mm Accuracy","24/7 Powered","Light Sensor","Zigbee 3.0"]'::jsonb, true, 2
),
(
  '66666666-6666-6666-6666-666666666666', 'Neon Flex RGBIC', 'Addressable LED • Music Sync', 'amber', 'Lightbulb',
  '["16M Colors","Voice Control","IP67 Waterproof","Auto Schedule"]'::jsonb, true, 3
)
ON CONFLICT (id) DO UPDATE SET
  title = excluded.title, description = excluded.description, accent = excluded.accent, icon = excluded.icon,
  chips = excluded.chips, is_active = excluded.is_active, display_order = excluded.display_order, updated_at = NOW();

-- ────────────────────────────────────────────────────────────────────────────
-- 10. Strict Execution Permissions Lockdown
-- ────────────────────────────────────────────────────────────────────────────

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

COMMIT;
