-- Consolidated Supabase schema migration
-- Generated on 2026-06-07.
-- This file contains the complete database schema, functions, and policies.

BEGIN;

-- ============================================================================
-- 1. Custom Enums & Types
-- ============================================================================

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

-- ============================================================================
-- 2. Table Creation
-- ============================================================================

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
  product_id       UUID          NOT NULL,
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
  product_id      UUID          NOT NULL UNIQUE,
  stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  serial_numbers  TEXT[]        NOT NULL DEFAULT '{}'::TEXT[],
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);

-- Product Pricing Matrix Table
CREATE TABLE IF NOT EXISTS public.product_pricing (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID          NOT NULL,
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

-- Services Table
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

CREATE INDEX IF NOT EXISTS idx_services_is_active      ON public.services (is_active);
CREATE INDEX IF NOT EXISTS idx_services_category       ON public.services (category);
CREATE INDEX IF NOT EXISTS idx_services_display_order  ON public.services (display_order);

-- FAQ Table
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

CREATE INDEX IF NOT EXISTS faqs_published_category_order_idx ON public.faqs (is_published, category, display_order);

-- Tax Rates and HSN Codes
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  rate NUMERIC(5,2) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hsn_codes (
  code VARCHAR(20) PRIMARY KEY,
  tax_rate_id INTEGER REFERENCES public.tax_rates(id) ON DELETE SET NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Policies Table (Legal/Content)
CREATE TABLE IF NOT EXISTS public.policies (
  key VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. Table Alterations & Constraints
-- ============================================================================

-- Products Table Enhancements
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status                    product_lifecycle_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS images                    TEXT[]        DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS is_serial_number_compulsory BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at                TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by                UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_deleted                BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archive_reason            TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_at               TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by               UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hsn_code                  TEXT,
  ADD COLUMN IF NOT EXISTS gst_rate                  NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS tax_ai_confidence          NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS tax_ai_justification       TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_model               TEXT,
  ADD COLUMN IF NOT EXISTS tax_ai_classified_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tax_ai_requested_by        UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed            BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_by         UUID,
  ADD COLUMN IF NOT EXISTS tax_ai_reviewed_at         TIMESTAMPTZ;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_hsn_code_8_digit_chk,
  ADD CONSTRAINT products_hsn_code_8_digit_chk CHECK (hsn_code IS NULL OR hsn_code ~ '^[0-9]{8}$') NOT VALID;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_gst_rate_standard_tier_chk,
  ADD CONSTRAINT products_gst_rate_standard_tier_chk CHECK (gst_rate IS NULL OR gst_rate IN (0, 5, 12, 18, 28)) NOT VALID;

-- Backfill archived status
UPDATE public.products SET is_deleted = TRUE, deleted_at = COALESCE(updated_at, NOW()), archive_reason = 'Pre-migration archived status'
WHERE status = 'archived' AND is_deleted = FALSE;

-- Foreign Keys for operational tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'stock_movements_product_id_fkey' AND table_name = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_product_id_fkey' AND table_name = 'inventory') THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'product_pricing_product_id_fkey' AND table_name = 'product_pricing') THEN
    ALTER TABLE public.product_pricing ADD CONSTRAINT product_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END;
$$;

-- Webhook Events event_id
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- Order Constraints (Cascade)
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order;
ALTER TABLE public.order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS fk_order_otp;
ALTER TABLE public.order_otp_verifications ADD CONSTRAINT fk_order_otp FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.sales_agent_commissions DROP CONSTRAINT IF EXISTS fk_sales_agent_commissions_order;
ALTER TABLE public.sales_agent_commissions ADD CONSTRAINT fk_sales_agent_commissions_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- ============================================================================
-- 4. Indexes & Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_active_created ON public.orders (created_at DESC) WHERE status != 'Cancelled' AND status != 'Rejected';
CREATE INDEX IF NOT EXISTS idx_products_active_catalog ON public.products (status, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products (archived_at DESC) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products (handle) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products (hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON public.products (gst_rate);
CREATE INDEX IF NOT EXISTS idx_products_tax_ai_review ON public.products (tax_ai_reviewed, tax_ai_classified_at DESC);

-- Conditional Indexes for optional tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'otp_verifications') THEN
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_code ON public.otp_verifications(code);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON public.otp_verifications(identifier);
    CREATE INDEX IF NOT EXISTS idx_otp_verifications_unverified_code ON public.otp_verifications(code, expires_at) WHERE verified = false;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_otp_verifications') THEN
    CREATE INDEX IF NOT EXISTS idx_order_otp_verifications_otp_code ON public.order_otp_verifications(otp_code);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_events') THEN
    CREATE INDEX IF NOT EXISTS idx_webhook_events_event_type ON public.webhook_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at);
  END IF;
END $$;

-- ============================================================================
-- 5. JWT & Role Helpers
-- ============================================================================

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

-- Redefine role protection trigger
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

-- ============================================================================
-- 6. Row Level Security Policies
-- ============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.innovation_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

-- Product Policies
DROP POLICY IF EXISTS rls_products_public_read ON public.products;
CREATE POLICY rls_products_public_read ON public.products FOR SELECT USING (is_deleted = FALSE AND status = 'active');
DROP POLICY IF EXISTS rls_products_admin_read ON public.products;
CREATE POLICY rls_products_admin_read ON public.products FOR SELECT USING (public.is_manager_or_admin());
DROP POLICY IF EXISTS rls_products_admin_write ON public.products;
CREATE POLICY rls_products_admin_write ON public.products FOR ALL USING (public.is_manager_or_admin());

-- Profile Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Inventory Policies
CREATE POLICY inventory_staff_select ON public.inventory FOR SELECT TO authenticated USING (public.is_staff_member());
CREATE POLICY inventory_staff_all ON public.inventory FOR ALL TO authenticated USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

-- FAQ Policies
CREATE POLICY "Allow public read access to published FAQs" ON public.faqs FOR SELECT USING (is_published = true);
CREATE POLICY "Allow full access to admin users" ON public.faqs FOR ALL TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'))
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin', 'super_admin'));

-- Security Table Policies
CREATE POLICY security_audit_log_superadmin_only ON public.security_audit_log FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());
CREATE POLICY security_settings_superadmin_only ON public.security_settings FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());

-- ============================================================================
-- 7. Core Database Functions
-- ============================================================================

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
  SELECT id, title, status, is_deleted INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_product_id; END IF;
  IF v_product.is_deleted THEN RAISE EXCEPTION 'Product % is already deleted', p_product_id; END IF;
  UPDATE public.products SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = p_deleted_by, status = 'archived', archived_at = NOW(), archived_by = p_deleted_by, archive_reason = p_reason, updated_at = NOW() WHERE id = p_product_id;
  RETURN jsonb_build_object('product_id', p_product_id, 'title', v_product.title, 'archived_at', NOW(), 'archived_by', p_deleted_by, 'reason', p_reason);
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
  SELECT COALESCE(stock_quantity, 0), COALESCE(min_stock_level, 5) INTO v_current_qty, v_min_stock FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product % not found', p_product_id USING ERRCODE = 'P0002'; END IF;
  IF p_movement_type = ANY(v_inbound) THEN v_new_qty := v_current_qty + p_quantity;
  ELSIF p_movement_type = ANY(v_outbound) THEN v_new_qty := v_current_qty - p_quantity;
    IF v_new_qty < 0 AND NOT p_allow_negative THEN RAISE EXCEPTION 'Insufficient stock' USING ERRCODE = 'P0001'; END IF;
  ELSIF p_movement_type = 'adjustment' THEN v_new_qty := p_quantity;
  ELSE v_new_qty := v_current_qty; END IF;
  v_new_status := CASE WHEN v_new_qty <= 0 THEN 'out_of_stock' WHEN v_new_qty <= v_min_stock THEN 'low_stock' ELSE 'in_stock' END;
  UPDATE public.products SET stock_quantity = v_new_qty, stock_status = v_new_status, updated_at = NOW() WHERE id = p_product_id;
  INSERT INTO public.stock_movements (product_id, movement_type, quantity_delta, quantity_before, quantity_after, reference_id, reference_type, notes, created_by)
  VALUES (p_product_id, p_movement_type, p_quantity, v_current_qty, v_new_qty, p_reference_id, p_reference_type, COALESCE(p_notes, p_movement_type || ' via system'), COALESCE(p_created_by, auth.uid()))
  RETURNING id INTO v_movement_id;
  RETURN jsonb_build_object('movement_id', v_movement_id, 'quantity_after', v_new_qty, 'stock_status', v_new_status);
END;
$$;

-- Auto Cancel Stale Orders
CREATE OR REPLACE FUNCTION public.auto_cancel_stale_orders_v1(
  p_cutoff TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 100,
  p_reason TEXT DEFAULT 'Automatically cancelled after 24 hours without payment confirmation.'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_cancelled INTEGER := 0;
  v_restored_items INTEGER := 0;
  v_stale_statuses TEXT[] := ARRAY['Pending', 'Awaiting Payment'];
  v_stale_payment_statuses TEXT[] := ARRAY['Awaiting Payment', 'Payment Confirmation Pending', 'Pending', 'Payment Failed', 'Payment Cancelled'];
BEGIN
  FOR v_order IN
    SELECT id, items FROM public.orders WHERE status = ANY(v_stale_statuses) AND created_at <= p_cutoff AND (payment_status = ANY(v_stale_payment_statuses) OR payment_status IS NULL)
    ORDER BY created_at ASC LIMIT GREATEST(COALESCE(p_limit, 100), 1) FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders SET status = 'Cancelled', payment_status = 'Payment Cancelled', cancellation_reason = p_reason, cancelled_at = NOW(), updated_at = NOW()
    WHERE id = v_order.id;
    IF FOUND THEN
      v_cancelled := v_cancelled + 1;
      IF v_order.items IS NOT NULL AND jsonb_typeof(v_order.items->'cart_items') = 'array' THEN
        FOR v_item IN SELECT COALESCE(value->>'id', value->>'productId')::UUID AS id, COALESCE((value->>'quantity')::INTEGER, 0) AS quantity FROM jsonb_array_elements(v_order.items->'cart_items') WHERE COALESCE(value->>'id', value->>'productId') IS NOT NULL
        LOOP
          IF v_item.quantity > 0 THEN
            PERFORM public.record_atomic_stock_movement(v_item.id, 'return', v_item.quantity, v_order.id::TEXT, 'online_order', 'Reverted stock due to stale unpaid order auto-cancellation', TRUE, NULL);
            v_restored_items := v_restored_items + 1;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('success', TRUE, 'cancelled', v_cancelled, 'restoredItems', v_restored_items);
END;
$$;

-- ============================================================================
-- 8. Seed Defaults
-- ============================================================================

INSERT INTO public.tax_rates (name, rate, is_default, description)
VALUES ('GST 5%', 5.00, false, '5% GST'), ('GST 12%', 12.00, false, '12% GST'), ('GST 18%', 18.00, true, '18% GST'), ('GST 28%', 28.00, false, '28% GST')
ON CONFLICT (name) DO UPDATE SET rate = EXCLUDED.rate;

-- ============================================================================
-- 9. Permissions Lockdown
-- ============================================================================

REVOKE ALL ON FUNCTION public.auto_cancel_stale_orders_v1(TIMESTAMPTZ, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_unsafe_profile_role_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_atomic_stock_movement(uuid, text, integer, text, text, text, boolean, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;

COMMIT;
