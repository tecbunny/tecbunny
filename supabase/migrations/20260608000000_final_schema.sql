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
$$ language 'plpgsql'
SET search_path = public, pg_temp;

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_superadmin_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.superadmin_token_blocklist WHERE expires_at < NOW();
$$;

-- Prune old logs function
CREATE OR REPLACE FUNCTION public.prune_old_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.webhook_events WHERE created_at < NOW() - INTERVAL '30 days';
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_messages') THEN
    DELETE FROM public.whatsapp_messages WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;
  DELETE FROM public.order_otp_verifications WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$;

-- ============================================================================
-- 1. Custom Enums & Types
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('created', 'sent', 'downloaded', 'expired', 'bidded', 'accepted', 'countered', 'rejected', 'declined');
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

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'advance_payment_status') THEN
    CREATE TYPE advance_payment_status AS ENUM ('pending', 'confirmed', 'payment_initiated', 'paid', 'completed');
  END IF;
END;
$$;

-- Ensure existing database enum has the new negotiation status values
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'bidded';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'countered';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'rejected';
ALTER TYPE public.quote_status ADD VALUE IF NOT EXISTS 'declined';

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
  marketing_metadata JSONB DEFAULT '{}'::jsonb,
  last_visit_at TIMESTAMPTZ DEFAULT NOW(),
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
  bulk_pricing_tiers JSONB DEFAULT '[]'::jsonb,
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
  used_free_installation BOOLEAN DEFAULT FALSE,
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
  customer_phone TEXT,
  customer_address TEXT,
  bidded_price NUMERIC,
  counter_price NUMERIC,
  negotiation_clauses TEXT,
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

-- Wishlist Items Table
CREATE TABLE IF NOT EXISTS public.wishlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, product_id)
);

-- Recovery Queue for Payment Failures
CREATE TABLE IF NOT EXISTS public.payment_recovery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    failure_reason TEXT,
    recovery_status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Advance Payment Requests Table
CREATE TABLE IF NOT EXISTS public.advance_payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  advance_amount NUMERIC(12,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'payu',
  payment_terms TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  customer_notes TEXT,
  final_quotation_url TEXT,
  payu_payment_id TEXT,
  transaction_id TEXT,
  payment_reference TEXT,
  confirmed_at TIMESTAMPTZ,
  payment_completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add advance_payment_id to quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS advance_payment_id UUID REFERENCES public.advance_payment_requests(id) ON DELETE SET NULL;

-- Marketing Broadcast Logs Table
CREATE TABLE IF NOT EXISTS public.marketing_broadcast_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_name TEXT NOT NULL,
    channel_type TEXT NOT NULL CHECK (channel_type IN ('whatsapp', 'email')),
    recipient_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    fail_count INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (execution_status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    failure_summary JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Free Installation Slots Table
CREATE TABLE IF NOT EXISTS public.free_installation_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL,
  total_slots INTEGER NOT NULL DEFAULT 10,
  remaining_slots INTEGER NOT NULL DEFAULT 10,
  confirmed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month)
);

-- ============================================================================
-- 3. Optimization Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS quotes_user_idx ON public.quotes(user_id);
CREATE INDEX IF NOT EXISTS quotes_expiry_idx ON public.quotes(expiry_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements (product_id, created_at DESC);

-- New indexes for marketing logic and advance payments
CREATE INDEX IF NOT EXISTS idx_payment_recovery_order ON public.payment_recovery_queue(order_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_quote_id ON public.advance_payment_requests(quote_id);
CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_status ON public.advance_payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_advance_payment_requests_admin_id ON public.advance_payment_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_free_installation_slots_month ON public.free_installation_slots(month);
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id ON public.whatsapp_messages (whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

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
ALTER TABLE public.superadmin_token_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_archive_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_recovery_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advance_payment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_broadcast_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.free_installation_slots ENABLE ROW LEVEL SECURITY;

-- Product Policies
DROP POLICY IF EXISTS rls_products_public_read ON public.products;
CREATE POLICY rls_products_public_read ON public.products FOR SELECT USING (is_deleted = FALSE AND status = 'active');
DROP POLICY IF EXISTS rls_products_admin_manage ON public.products;
CREATE POLICY rls_products_admin_manage ON public.products FOR ALL TO authenticated USING (public.is_manager_or_admin());

-- Profile Policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Order Policies
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = customer_id);
DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.is_staff_member());

-- Inventory Policies
DROP POLICY IF EXISTS inventory_staff_all ON public.inventory;
CREATE POLICY inventory_staff_all ON public.inventory FOR ALL TO authenticated USING (public.is_staff_member()) WITH CHECK (public.is_staff_member());

-- FAQ Policies
DROP POLICY IF EXISTS "Allow public read access to published FAQs" ON public.faqs;
CREATE POLICY "Allow public read access to published FAQs" ON public.faqs FOR SELECT USING (is_published = true);

-- Payment Transactions Policies
DROP POLICY IF EXISTS "Staff can view all payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff can view all payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (public.is_staff_member());
DROP POLICY IF EXISTS "Customers can view own payment transactions" ON public.payment_transactions;
CREATE POLICY "Customers can view own payment transactions" ON public.payment_transactions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = payment_transactions.order_id
        AND orders.customer_id = auth.uid()
    )
  );

-- Product Archive Log Policies
DROP POLICY IF EXISTS "Staff can view product archive log" ON public.product_archive_log;
CREATE POLICY "Staff can view product archive log" ON public.product_archive_log
  FOR SELECT TO authenticated USING (public.is_manager_or_admin());

-- Superadmin Token Blocklist Policies
DROP POLICY IF EXISTS "Superadmins can manage token blocklist" ON public.superadmin_token_blocklist;
CREATE POLICY "Superadmins can manage token blocklist" ON public.superadmin_token_blocklist
  FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());

-- Security Table Policies
DROP POLICY IF EXISTS security_audit_log_superadmin_only ON public.security_audit_log;
CREATE POLICY security_audit_log_superadmin_only ON public.security_audit_log FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());
DROP POLICY IF EXISTS security_settings_superadmin_only ON public.security_settings;
CREATE POLICY security_settings_superadmin_only ON public.security_settings FOR ALL TO authenticated USING (public.is_superadmin_user()) WITH CHECK (public.is_superadmin_user());

-- Wishlist Policies
DROP POLICY IF EXISTS "Users can view own wishlist items" ON public.wishlist_items;
CREATE POLICY "Users can view own wishlist items" ON public.wishlist_items FOR SELECT TO authenticated USING (profile_id = auth.uid());
DROP POLICY IF EXISTS "Users can insert own wishlist items" ON public.wishlist_items;
CREATE POLICY "Users can insert own wishlist items" ON public.wishlist_items FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS "Users can delete own wishlist items" ON public.wishlist_items;
CREATE POLICY "Users can delete own wishlist items" ON public.wishlist_items FOR DELETE TO authenticated USING (profile_id = auth.uid());

-- Advance Payment Requests Policies
DROP POLICY IF EXISTS "Customers can view their own advance requests" ON public.advance_payment_requests;
CREATE POLICY "Customers can view their own advance requests" ON public.advance_payment_requests FOR SELECT USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = advance_payment_requests.quote_id AND quotes.user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins can view all advance requests" ON public.advance_payment_requests;
CREATE POLICY "Admins can view all advance requests" ON public.advance_payment_requests FOR SELECT TO authenticated USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));
DROP POLICY IF EXISTS "Admins can create advance requests" ON public.advance_payment_requests;
CREATE POLICY "Admins can create advance requests" ON public.advance_payment_requests FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));
DROP POLICY IF EXISTS "Admins can update advance requests" ON public.advance_payment_requests;
CREATE POLICY "Admins can update advance requests" ON public.advance_payment_requests FOR UPDATE TO authenticated USING (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager')) WITH CHECK (auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'manager'));
DROP POLICY IF EXISTS "Customers can update their advance requests" ON public.advance_payment_requests;
CREATE POLICY "Customers can update their advance requests" ON public.advance_payment_requests FOR UPDATE USING (EXISTS (SELECT 1 FROM public.quotes WHERE quotes.id = advance_payment_requests.quote_id AND quotes.user_id = auth.uid()));

-- Marketing Broadcast Logs Policies
DROP POLICY IF EXISTS "Admins can insert broadcast logs" ON public.marketing_broadcast_logs;
CREATE POLICY "Admins can insert broadcast logs" 
ON public.marketing_broadcast_logs 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Admins can view broadcast logs" ON public.marketing_broadcast_logs;
CREATE POLICY "Admins can view broadcast logs" 
ON public.marketing_broadcast_logs 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('admin', 'superadmin')
  )
);

DROP POLICY IF EXISTS "Service role full access on marketing_broadcast_logs" ON public.marketing_broadcast_logs;
CREATE POLICY "Service role full access on marketing_broadcast_logs"
ON public.marketing_broadcast_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Free Installation Slots Policies
DROP POLICY IF EXISTS "Allow public read access to free installation slots" ON public.free_installation_slots;
CREATE POLICY "Allow public read access to free installation slots" 
ON public.free_installation_slots 
FOR SELECT 
TO public
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update of free installation slots" ON public.free_installation_slots;
CREATE POLICY "Allow authenticated update of free installation slots" 
ON public.free_installation_slots 
FOR UPDATE 
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

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
  SELECT status, payment_status, items INTO v_current_status, v_current_payment_status, v_items_json
  FROM public.orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', target_order_id;
  END IF;

  IF v_current_status IN ('Cancelled', 'Rejected', 'Completed', 'Delivered') AND new_status NOT IN ('Cancelled', 'Rejected', 'Completed', 'Delivered') THEN
    RAISE EXCEPTION 'Cannot transition order % from terminal state (%) to %', target_order_id, v_current_status, new_status;
  END IF;

  UPDATE public.orders
  SET
    status = new_status,
    payment_status = COALESCE(new_payment_status, payment_status),
    processed_by = p_processed_by,
    updated_at = NOW()
  WHERE id = target_order_id;

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

  IF p_pickup_code IS NOT NULL AND p_pickup_code <> '' THEN
    UPDATE public.orders SET pickup_code = p_pickup_code WHERE id = target_order_id;
  END IF;

  IF new_status IN ('Cancelled', 'Rejected') THEN
    UPDATE public.orders
    SET
      cancelled_at = NOW(),
      cancelled_by = p_processed_by
    WHERE id = target_order_id;

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
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_part RECORD;
  v_total_parts_cost NUMERIC := 0;
  v_total_cost NUMERIC := 0;
  v_current_status TEXT;
BEGIN
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

-- Wishlist matchmaking function and trigger
CREATE OR REPLACE FUNCTION public.match_wishlist_coupons()
RETURNS TRIGGER AS $$
DECLARE
    user_wishlist_count INT;
    available_coupon_code TEXT;
    marketing_meta JSONB;
BEGIN
    SELECT COUNT(*) INTO user_wishlist_count 
    FROM public.wishlist_items 
    WHERE profile_id = NEW.profile_id;

    IF user_wishlist_count >= 3 AND NOT EXISTS (
        SELECT 1 FROM public.orders 
        WHERE customer_email = (SELECT email FROM public.profiles WHERE id = NEW.profile_id)
    ) THEN
        SELECT code INTO available_coupon_code 
        FROM public.coupons 
        WHERE status = 'active' 
        AND type = 'percentage'
        AND expiry_date > NOW()
        ORDER BY value DESC
        LIMIT 1;

        IF available_coupon_code IS NOT NULL THEN
            SELECT marketing_metadata INTO marketing_meta FROM public.profiles WHERE id = NEW.profile_id;
            marketing_meta = jsonb_set(
                COALESCE(marketing_meta, '{}'::jsonb), 
                '{suggested_coupon}', 
                jsonb_build_object(
                    'code', available_coupon_code,
                    'reason', 'wishlist_loyalty',
                    'matched_at', NOW()
                )
            );
            
            UPDATE public.profiles 
            SET marketing_metadata = marketing_meta 
            WHERE id = NEW.profile_id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trigger_match_wishlist_coupons ON public.wishlist_items;
CREATE TRIGGER trigger_match_wishlist_coupons
AFTER INSERT ON public.wishlist_items
FOR EACH ROW EXECUTE FUNCTION public.match_wishlist_coupons();

-- Advance payment status change tracking function and trigger
CREATE OR REPLACE FUNCTION public.track_advance_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.security_audit_log (
      user_id,
      action,
      resource,
      details,
      severity,
      event_type,
      event_data
    ) VALUES (
      auth.uid(),
      'status_update',
      'advance_payment_requests',
      jsonb_build_object(
        'table_name', 'advance_payment_requests',
        'record_id', NEW.id,
        'old_value', OLD.status,
        'new_value', NEW.status
      ),
      'info',
      'advance_payment_status_change',
      jsonb_build_object(
        'table_name', 'advance_payment_requests',
        'record_id', NEW.id,
        'old_value', OLD.status,
        'new_value', NEW.status
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS advance_payment_status_change_trigger ON public.advance_payment_requests;
CREATE TRIGGER advance_payment_status_change_trigger
AFTER UPDATE ON public.advance_payment_requests
FOR EACH ROW EXECUTE FUNCTION public.track_advance_payment_status_change();

-- Free Installation Slots Functions
CREATE OR REPLACE FUNCTION public.get_or_create_monthly_slot()
RETURNS TABLE (id UUID, remaining_slots INTEGER) AS $$
DECLARE
  v_month DATE;
  v_slot_record RECORD;
BEGIN
  v_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  -- Try to get existing record
  SELECT * INTO v_slot_record FROM public.free_installation_slots WHERE month = v_month;
  
  IF v_slot_record IS NULL THEN
    -- Create new record for this month
    INSERT INTO public.free_installation_slots (month, total_slots, remaining_slots, confirmed_count)
    VALUES (v_month, 10, 10, 0)
    RETURNING free_installation_slots.id, free_installation_slots.remaining_slots INTO id, remaining_slots;
  ELSE
    id := v_slot_record.id;
    remaining_slots := v_slot_record.remaining_slots;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.decrement_free_installation_slot()
RETURNS BOOLEAN AS $$
DECLARE
  v_month DATE;
  v_remaining INTEGER;
BEGIN
  v_month := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  
  UPDATE public.free_installation_slots 
  SET remaining_slots = GREATEST(0, remaining_slots - 1),
      confirmed_count = confirmed_count + 1,
      updated_at = NOW()
  WHERE month = v_month;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================================================
-- 7. Seed Defaults
-- ============================================================================

INSERT INTO public.tax_rates (name, rate, is_default, description)
VALUES ('GST 5%', 5.00, false, '5% GST'), ('GST 12%', 12.00, false, '12% GST'), ('GST 18%', 18.00, true, '18% GST'), ('GST 28%', 28.00, false, '28% GST')
ON CONFLICT (name) DO UPDATE SET rate = EXCLUDED.rate;

-- ============================================================================
-- 8. Permissions Lockdown
-- ============================================================================

-- Revoke all direct execution from public roles for SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.cleanup_expired_superadmin_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_old_logs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.soft_delete_product(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_atomic_stock_movement(uuid, text, integer, text, text, text, boolean, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_order_inventory_atomic(text, uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, text, text, jsonb, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_order_otp_atomic(uuid, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_superadmin_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_staff_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_role_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_profile_role_to_auth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_wishlist_coupons() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.track_advance_payment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_monthly_slot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_free_installation_slot() FROM PUBLIC, anon, authenticated;

-- Explicitly grant execute to authorized roles
GRANT EXECUTE ON FUNCTION public.is_superadmin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_otp_atomic(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_order_inventory_atomic(TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_wishlist_coupons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.track_advance_payment_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_monthly_slot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_free_installation_slot() TO authenticated;

COMMIT;
