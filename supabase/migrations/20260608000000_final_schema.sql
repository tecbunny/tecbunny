-- Consolidated Supabase schema migration (Final)
-- Generated on 2026-06-08.
-- This file contains the complete database schema, functions, and policies.
-- It merges all previous migrations into a single source of truth.

BEGIN;

-- ============================================================================
-- 0. Standard Helpers
-- ============================================================================

-- Standard helper to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

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

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_agent_status') THEN
    CREATE TYPE sales_agent_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status') THEN
    CREATE TYPE redemption_status AS ENUM ('pending', 'approved', 'rejected', 'processed');
  END IF;
END;
$$;

-- ============================================================================
-- 2. Core Table Creation
-- ============================================================================

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  full_name TEXT,
  email TEXT UNIQUE,
  mobile TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  customer_type TEXT DEFAULT 'B2C',
  customer_category TEXT DEFAULT 'Normal',
  address JSONB DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE,
  name TEXT,
  title TEXT,
  description TEXT,
  short_description TEXT,
  category TEXT,
  subcategory TEXT,
  brand TEXT,
  model TEXT,
  model_number TEXT,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(12,2) DEFAULT 0,
  base_price NUMERIC(12,2),
  cost_price NUMERIC(12,2),
  mrp NUMERIC(12,2),
  offer_price NUMERIC(12,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  min_stock_level INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  images TEXT[] DEFAULT '{}'::TEXT[],
  additional_images TEXT[] DEFAULT '{}'::TEXT[],
  features JSONB NOT NULL DEFAULT '[]'::JSONB,
  specifications JSONB NOT NULL DEFAULT '{}'::JSONB,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  status product_lifecycle_status NOT NULL DEFAULT 'draft',
  product_type TEXT DEFAULT 'physical',
  popularity INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  warranty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  prioritized BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Soft Delete columns
  deleted_at                TIMESTAMPTZ   DEFAULT NULL,
  deleted_by                UUID          DEFAULT NULL,
  is_deleted                BOOLEAN       NOT NULL DEFAULT FALSE,
  archive_reason            TEXT          DEFAULT NULL,
  archived_at               TIMESTAMPTZ   DEFAULT NULL,
  archived_by               UUID          DEFAULT NULL,

  -- AI & Tax columns
  hsn_code                  TEXT,
  gst_rate                  NUMERIC(5,2),
  tax_ai_confidence          NUMERIC(4,3),
  tax_ai_justification       TEXT,
  tax_ai_model               TEXT,
  tax_ai_classified_at       TIMESTAMPTZ,
  tax_ai_requested_by        UUID,
  tax_ai_reviewed            BOOLEAN       NOT NULL DEFAULT FALSE,
  tax_ai_reviewed_by         UUID,
  tax_ai_reviewed_at         TIMESTAMPTZ
);

-- Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id UUID,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_mobile TEXT,
  billing_address JSONB DEFAULT '{}'::JSONB,
  shipping_address JSONB DEFAULT '{}'::JSONB,
  items JSONB NOT NULL DEFAULT '{}'::JSONB,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  gst_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT,
  payment_status TEXT DEFAULT 'Awaiting Payment',
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  type TEXT,
  source TEXT DEFAULT 'online',
  delivery_address TEXT,
  notes TEXT,
  internal_notes TEXT,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pickup_code TEXT,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  tracking_number TEXT,
  courier_name TEXT,
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  product_sku TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  serial_numbers TEXT[] DEFAULT '{}'::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    transaction_id TEXT UNIQUE NOT NULL,
    payment_method TEXT,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT NOT NULL,
    gateway_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- Services Table
CREATE TABLE IF NOT EXISTS public.services (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  name          TEXT,
  slug          TEXT          UNIQUE,
  description   TEXT,
  short_description TEXT,
  details       TEXT,
  icon          TEXT,
  icon_name     TEXT,
  badge         TEXT,
  features      JSONB         NOT NULL DEFAULT '[]'::JSONB,
  feature_list  JSONB,
  is_active     BOOLEAN       NOT NULL DEFAULT TRUE,
  status        TEXT          DEFAULT 'active',
  price         NUMERIC(12,2),
  base_price    NUMERIC(12,2),
  currency      TEXT          NOT NULL DEFAULT 'INR',
  duration_days INTEGER,
  duration_hours INTEGER,
  category      TEXT          DEFAULT 'Support',
  display_order INTEGER       NOT NULL DEFAULT 0,
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  requirements  JSONB         NOT NULL DEFAULT '[]'::JSONB,
  is_featured   BOOLEAN       NOT NULL DEFAULT FALSE,
  metadata      JSONB         NOT NULL DEFAULT '{}'::JSONB,
  created_by    UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- FAQ Table
CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL DEFAULT 'General',
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Stock Movements Ledger
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
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

-- Serialized Inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID          NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  stock           INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
  serial_numbers  TEXT[]        NOT NULL DEFAULT '{}'::TEXT[],
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Tax and Policy Tables
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

CREATE TABLE IF NOT EXISTS public.policies (
  key VARCHAR(50) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content JSONB NOT NULL,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Token Blocklist
CREATE TABLE IF NOT EXISTS public.superadmin_token_blocklist (
  jti         UUID         PRIMARY KEY,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Innovation Content
CREATE TABLE IF NOT EXISTS public.innovation_modes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT        UNIQUE,
  label         TEXT,
  sub           TEXT,
  title         TEXT,
  description   TEXT,
  icon          TEXT,
  rec_id        TEXT,
  items         JSONB       NOT NULL DEFAULT '[]'::JSONB,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.innovation_devices (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT,
  description   TEXT,
  accent        TEXT,
  icon          TEXT,
  chips         JSONB       NOT NULL DEFAULT '[]'::JSONB,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operational Tables (Settings, Logs, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  category TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  id UUID DEFAULT gen_random_uuid()
);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT,
  resource TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  severity TEXT DEFAULT 'info',
  event_type TEXT,
  event_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE,
  setting_key TEXT UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  setting_value JSONB,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  phone TEXT,
  whatsapp_message_id TEXT,
  direction TEXT,
  message_type TEXT,
  body TEXT,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  otp_code TEXT,
  phone TEXT,
  customer_phone TEXT,
  email TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Optimization Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS quotes_user_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_expiry_idx ON public.quotes(expiry_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_services_is_active ON public.services (is_active);
CREATE INDEX IF NOT EXISTS faqs_published_category_order_idx ON public.faqs (is_published, category, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_active_created ON public.orders (created_at DESC) WHERE status != 'Cancelled' AND status != 'Rejected';
CREATE INDEX IF NOT EXISTS idx_products_active_catalog ON public.products (status, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_archived ON public.products (archived_at DESC) WHERE is_deleted = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products (handle) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products (hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_gst_rate ON public.products (gst_rate);
CREATE INDEX IF NOT EXISTS idx_products_tax_ai_review ON public.products (tax_ai_reviewed, tax_ai_classified_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_superadmin_token_blocklist_expiry ON public.superadmin_token_blocklist(expires_at);

-- ============================================================================
-- 4. JWT & Role Helpers
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

-- Role change protection trigger
CREATE OR REPLACE FUNCTION public.protect_profile_role_column()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.role IS DISTINCT FROM NEW.role AND NOT (
        public.is_manager_or_admin() OR 
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    ) THEN
        NEW.role := OLD.role;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_protect_profile_role_column ON public.profiles;
CREATE TRIGGER tr_protect_profile_role_column
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role_column();

-- ============================================================================
-- 5. Row Level Security Policies
-- ============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hsn_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Product Policies
CREATE POLICY rls_products_public_read ON public.products FOR SELECT USING (is_deleted = FALSE AND status = 'active');
CREATE POLICY rls_products_admin_manage ON public.products FOR ALL TO authenticated USING (public.is_manager_or_admin());

-- Profile Policies
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Order Policies
CREATE POLICY "Customers can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff_member());

-- Inventory Policies
CREATE POLICY inventory_staff_all ON public.inventory FOR ALL TO authenticated USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

-- FAQ Policies
CREATE POLICY "Allow public read access to published FAQs" ON public.faqs FOR SELECT USING (is_published = true);

-- Security Table Policies
CREATE POLICY security_audit_log_superadmin_only ON public.security_audit_log FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());
CREATE POLICY security_settings_superadmin_only ON public.security_settings FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());

-- ============================================================================
-- 6. Core Database Functions
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

-- Atomic Order Inventory Allocation
CREATE OR REPLACE FUNCTION public.allocate_order_inventory_atomic(
  p_customer_name   TEXT,
  p_customer_id     UUID,
  p_customer_email  TEXT,
  p_customer_phone  TEXT,
  p_delivery_address TEXT,
  p_notes           TEXT,
  p_payment_method  TEXT,
  p_subtotal        NUMERIC,
  p_gst_amount      NUMERIC,
  p_total           NUMERIC,
  p_discount_amount NUMERIC,
  p_shipping_amount NUMERIC,
  p_payment_status  TEXT,
  p_order_type      TEXT,
  p_items           JSONB,
  p_agent_id        UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item         RECORD;
  v_order_id     UUID;
  v_product_id   UUID;
  v_qty          INTEGER;
  v_order_row    JSONB;
BEGIN
  INSERT INTO public.orders (
    customer_id, customer_name, customer_email, customer_phone, delivery_address, notes, payment_method, subtotal, gst_amount, total, discount_amount, shipping_amount, payment_status, status, items, agent_id
  ) VALUES (
    p_customer_id, p_customer_name, p_customer_email, p_customer_phone, p_delivery_address, p_notes, p_payment_method, p_subtotal, p_gst_amount, p_total, p_discount_amount, p_shipping_amount, COALESCE(p_payment_status, 'Awaiting Payment'), 'Pending', p_items, p_agent_id
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items->'cart_items') AS x
  LOOP
    v_product_id := (v_item.value->>'product_id')::UUID;
    IF v_product_id IS NULL THEN v_product_id := (v_item.value->>'id')::UUID; END IF;
    v_qty := (v_item.value->>'quantity')::INTEGER;
    IF v_product_id IS NOT NULL AND v_qty > 0 THEN
      PERFORM public.record_atomic_stock_movement(v_product_id, 'online_sale', v_qty, v_order_id::TEXT, 'online_order', 'Inventory allocated for order ' || v_order_id, FALSE, p_customer_id);
    END IF;
  END LOOP;
  SELECT to_jsonb(o.*) INTO v_order_row FROM public.orders o WHERE id = v_order_id;
  RETURN jsonb_build_object('success', TRUE, 'order', v_order_row);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- Atomic OTP Verification
CREATE OR REPLACE FUNCTION public.verify_order_otp_atomic(
  p_order_id       UUID,
  p_customer_phone TEXT,
  p_otp_code       TEXT,
  p_max_attempts   INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_otp_record RECORD;
  v_now        TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_otp_record FROM public.order_otp_verifications WHERE order_id = p_order_id AND customer_phone = p_customer_phone AND verified = FALSE FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', FALSE, 'error', 'OTP not found or already verified'); END IF;
  IF v_otp_record.expires_at < v_now THEN RETURN jsonb_build_object('success', FALSE, 'error', 'OTP has expired'); END IF;
  IF v_otp_record.attempts >= p_max_attempts THEN RETURN jsonb_build_object('success', FALSE, 'error', 'Maximum verification attempts exceeded'); END IF;
  UPDATE public.order_otp_verifications SET attempts = attempts + 1 WHERE id = v_otp_record.id;
  IF v_otp_record.otp_code = p_otp_code THEN
    UPDATE public.order_otp_verifications SET verified = TRUE, verified_at = v_now WHERE id = v_otp_record.id;
    UPDATE public.orders SET otp_verified = TRUE, updated_at = v_now WHERE id = p_order_id;
    RETURN jsonb_build_object('success', TRUE, 'verified', TRUE);
  ELSE
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid OTP code', 'attempts_left', p_max_attempts - (v_otp_record.attempts + 1));
  END IF;
END;
$$;

-- ============================================================================
-- 7. Seed Defaults
-- ============================================================================

INSERT INTO public.tax_rates (name, rate, is_default, description)
VALUES ('GST 5%', 5.00, false, '5% GST'), ('GST 12%', 12.00, false, '12% GST'), ('GST 18%', 18.00, true, '18% GST'), ('GST 28%', 28.00, false, '28% GST')
ON CONFLICT (name) DO UPDATE SET rate = EXCLUDED.rate;

-- ============================================================================
-- 8. Permissions Lockdown
-- ============================================================================

REVOKE ALL ON FUNCTION public.soft_delete_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_atomic_stock_movement(uuid, text, integer, text, text, text, boolean, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_otp_atomic(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_order_inventory_atomic(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB, UUID) TO authenticated;

COMMIT;
