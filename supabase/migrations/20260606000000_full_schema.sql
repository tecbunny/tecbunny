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


-- Standard helper to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

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

-- ============================================================================
-- Fresh Supabase account bootstrap
-- ============================================================================
-- The historical migrations below were consolidated from an already-running
-- project, so some later ALTER TABLE / RLS / RPC statements assume older tables
-- already exist. Keep this bootstrap section before those statements so this
-- file can initialize a brand-new Supabase project without missing core tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sales_agent_status') THEN
    CREATE TYPE sales_agent_status AS ENUM ('pending', 'approved', 'rejected');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'redemption_status') THEN
    CREATE TYPE redemption_status AS ENUM ('pending', 'approved', 'rejected', 'processed');
  END IF;
END;
$$;

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

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT UNIQUE,
  name TEXT NOT NULL,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
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

CREATE TABLE IF NOT EXISTS public.order_otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  otp_code TEXT,
  phone TEXT,
  email TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  reason TEXT,
  cancelled_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  whatsapp_number TEXT,
  address JSONB DEFAULT '{}'::JSONB,
  customer_type TEXT DEFAULT 'B2C',
  customer_category TEXT DEFAULT 'Normal',
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_spent NUMERIC(12,2) NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  provider TEXT,
  method TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  transaction_id TEXT,
  reference_id TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  provider TEXT,
  transaction_id TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  status TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  category TEXT,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.page_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT UNIQUE,
  key TEXT,
  title TEXT,
  content JSONB NOT NULL DEFAULT '{}'::JSONB,
  data JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'published',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  resource_id TEXT,
  resource_type TEXT,
  properties JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  message TEXT,
  source TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource TEXT,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
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

CREATE TABLE IF NOT EXISTS public.user_mfa_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  phone_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  webauthn_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  backup_codes_generated BOOLEAN NOT NULL DEFAULT FALSE,
  secret TEXT,
  recovery_codes TEXT[] DEFAULT '{}'::TEXT[],
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  otp TEXT NOT NULL,
  otp_code TEXT,
  type TEXT NOT NULL DEFAULT 'signup',
  channel TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  otp_code TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'signup',
  channel TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_key TEXT NOT NULL,
  limit_type TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_communication_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferredOTPChannel TEXT NOT NULL DEFAULT 'whatsapp',
  emailNotifications BOOLEAN NOT NULL DEFAULT TRUE,
  whatsappNotifications BOOLEAN NOT NULL DEFAULT TRUE,
  orderUpdates BOOLEAN NOT NULL DEFAULT TRUE,
  serviceUpdates BOOLEAN NOT NULL DEFAULT TRUE,
  securityAlerts BOOLEAN NOT NULL DEFAULT TRUE,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT,
  provider TEXT,
  event_type TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT,
  event_type TEXT,
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_event_at TIMESTAMPTZ,
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

CREATE TABLE IF NOT EXISTS public.customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  channel TEXT,
  interaction_type TEXT,
  summary TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  address JSONB DEFAULT '{}'::JSONB,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID REFERENCES public.service_requests(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  engineer_id UUID,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  notes TEXT,
  completion_notes TEXT,
  engineer_notes TEXT,
  service_charge NUMERIC(12,2) DEFAULT 0,
  parts_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  actual_duration INTEGER,
  photos TEXT[] DEFAULT '{}'::TEXT[],
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  warranty_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.service_engineers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  skills TEXT[] DEFAULT '{}'::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  status sales_agent_status NOT NULL DEFAULT 'pending',
  agent_code TEXT UNIQUE,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  points_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_points NUMERIC(12,2) NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales_agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.sales_agents(id) ON DELETE SET NULL,
  order_id UUID,
  order_total NUMERIC(12,2) DEFAULT 0,
  commission_amount NUMERIC(12,2) DEFAULT 0,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  commission_rate_snapshot JSONB DEFAULT '{}'::JSONB,
  points_awarded NUMERIC(12,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_redemption_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES public.sales_agents(id) ON DELETE CASCADE,
  points_to_redeem NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) DEFAULT 0,
  status redemption_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  supplier_name TEXT,
  invoice_number TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) DEFAULT 0,
  total_cost NUMERIC(12,2) DEFAULT 0,
  serial_numbers TEXT[] DEFAULT '{}'::TEXT[],
  purchase_date DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  serial_number TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  values JSONB NOT NULL DEFAULT '[]'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  title TEXT,
  sku TEXT,
  options JSONB NOT NULL DEFAULT '{}'::JSONB,
  price NUMERIC(12,2),
  mrp NUMERIC(12,2),
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  code TEXT UNIQUE,
  discount_type TEXT,
  discount_value NUMERIC(12,2) DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auto_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL DEFAULT '{}'::JSONB,
  actions JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  title TEXT,
  description TEXT,
  discount_type TEXT,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT,
  description TEXT,
  discount_type TEXT,
  discount_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(12,2) DEFAULT 0,
  max_discount NUMERIC(12,2),
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  discount_id UUID REFERENCES public.discounts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID,
  promotion_type TEXT,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.offer_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_setup_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_setup_systems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.custom_setup_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_setup_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_id UUID REFERENCES public.custom_setup_systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  component_type TEXT,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_setup_component_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID REFERENCES public.custom_setup_components(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  value TEXT,
  price_delta NUMERIC(12,2) DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.custom_setup_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  expense_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  path TEXT,
  bucket TEXT DEFAULT 'images',
  alt TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_products_handle ON public.products(handle);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON public.orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limits_lookup ON public.otp_rate_limits(limit_key, limit_type, requested_at DESC);

CREATE OR REPLACE VIEW public.product_analytics_view AS
SELECT
  p.id,
  COALESCE(p.title, p.name) AS title,
  COUNT(a.id)::INTEGER AS view_count,
  MAX(a.created_at) AS last_viewed_at
FROM public.products p
LEFT JOIN public.analytics_events a
  ON a.resource_id = p.id::TEXT
 AND a.event_type IN ('product_view', 'view_product')
GROUP BY p.id, p.title, p.name;

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('images', 'images', TRUE),
  ('hero-banners', 'hero-banners', TRUE),
  ('TecBunny Solution', 'TecBunny Solution', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Compatibility columns consolidated in section 1 or handled via specific migrations below.

CREATE INDEX IF NOT EXISTS idx_orders_order_id ON public.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_stats_date ON public.webhook_stats(date DESC);
CREATE INDEX IF NOT EXISTS idx_offers_active_priority ON public.offers(is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_auto_offers_active_priority ON public.auto_offers(is_active, priority DESC);

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

ALTER TABLE public.innovation_modes
  ALTER COLUMN key DROP NOT NULL,
  ALTER COLUMN label DROP NOT NULL,
  ALTER COLUMN sub DROP NOT NULL,
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN icon DROP NOT NULL,
  ALTER COLUMN rec_id DROP NOT NULL;

ALTER TABLE public.innovation_devices
  ALTER COLUMN title DROP NOT NULL,
  ALTER COLUMN description DROP NOT NULL,
  ALTER COLUMN accent DROP NOT NULL,
  ALTER COLUMN icon DROP NOT NULL;

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

ALTER TABLE public.product_pricing
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT;

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
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'stock_movements_product_id_fkey' 
    AND table_name = 'stock_movements'
  ) THEN
    ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'inventory_product_id_fkey' 
    AND table_name = 'inventory'
  ) THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_pricing_product_id_fkey' 
    AND table_name = 'product_pricing'
  ) THEN
    ALTER TABLE public.product_pricing ADD CONSTRAINT product_pricing_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
END;
$$;

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
  v_cart_items      JSONB;
BEGIN
  v_cart_items := CASE
    WHEN jsonb_typeof(p_items) = 'array' THEN p_items
    WHEN jsonb_typeof(p_items->'cart_items') = 'array' THEN p_items->'cart_items'
    ELSE '[]'::JSONB
  END;

  IF jsonb_array_length(v_cart_items) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one cart item' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1 FROM public.products
   WHERE id IN (SELECT (value->>'id')::uuid FROM jsonb_array_elements(v_cart_items))
   ORDER BY id FOR UPDATE;

  FOR v_item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS quantity, (value->>'name')::text AS name FROM jsonb_array_elements(v_cart_items) LOOP
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

  FOR v_item IN SELECT (value->>'id')::uuid AS id, (value->>'quantity')::integer AS quantity FROM jsonb_array_elements(v_cart_items) LOOP
    PERFORM public.record_atomic_stock_movement(
      v_item.id, 'online_sale', v_item.quantity, v_order_id::text, 'online_order', 'Atomic order checkout placement', false, p_customer_id
    );
  END LOOP;

  v_order_items_val := jsonb_build_object(
    'cart_items', v_cart_items, 'customer_email', p_customer_email, 'customer_phone', p_customer_phone, 'delivery_address', p_delivery_address,
    'pickup_store', CASE WHEN p_order_type = 'Pickup' THEN p_delivery_address ELSE null END, 'payment_method', p_payment_method,
    'customer_notes', p_notes, 'agent_id', p_agent_id, 'otp_required', CASE WHEN p_agent_id IS NOT NULL THEN true ELSE false END
  );

  INSERT INTO public.orders (
    id, order_id, customer_name, customer_id, status, subtotal, gst_amount, total, total_amount, amount, type, order_type,
    items, delivery_address, notes, payment_method, customer_email, customer_phone, discount_amount, shipping_amount, payment_status, created_at
  ) VALUES (
    v_order_id, v_order_id::TEXT, p_customer_name, p_customer_id, 'Pending', p_subtotal, p_gst_amount, p_total, p_total, p_total,
    p_order_type, p_order_type, v_order_items_val, p_delivery_address, p_notes, p_payment_method, p_customer_email, p_customer_phone,
    p_discount_amount, p_shipping_amount, p_payment_status, NOW()
  ) RETURNING jsonb_build_object(
    'id', id, 'customer_name', customer_name, 'customer_id', customer_id, 'status', status, 'subtotal', subtotal, 'gst_amount', gst_amount,
    'total', total, 'total_amount', total_amount, 'order_id', order_id, 'type', type, 'items', items, 'delivery_address', delivery_address, 'notes', notes, 'payment_method', payment_method,
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

REVOKE EXECUTE ON FUNCTION public.set_contact_messages_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_name() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_page_content_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- Source: 20260604000500_services_icon_name.sql
-- ============================================================================
Table services consolidated in Section 1.icon_name     TEXT,
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

-- Table faqs consolidated in Section 1.

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

-- 7. Attach trigger to faqs table
DROP TRIGGER IF EXISTS set_faqs_updated_at ON public.faqs;
CREATE TRIGGER set_faqs_updated_at
    BEFORE UPDATE ON public.faqs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'identifier') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON public.otp_verifications(identifier);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'verified') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_unverified_expires ON public.otp_verifications(expires_at)
      WHERE verified = false;
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

-- Security helpers consolidated in section 4.

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

-- Redundant column additions removed.

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
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'identifier') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_identifier ON public.otp_verifications(identifier);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'otp_verifications' AND column_name = 'verified') THEN
      CREATE INDEX IF NOT EXISTS idx_otp_verifications_unverified_code ON public.otp_verifications(code, expires_at)
      WHERE verified = false;
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

-- Redundant column additions removed (already handled in earlier ALTER sections).

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

-- ============================================================================
-- Compatibility RPCs required by the application
-- ============================================================================

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
  v_stale_payment_statuses TEXT[] := ARRAY[
    'Awaiting Payment',
    'Payment Confirmation Pending',
    'Pending',
    'Payment Failed',
    'Payment Cancelled'
  ];
BEGIN
  FOR v_order IN
    SELECT id, items
    FROM public.orders
    WHERE status = ANY(v_stale_statuses)
      AND created_at <= p_cutoff
      AND (payment_status = ANY(v_stale_payment_statuses) OR payment_status IS NULL)
    ORDER BY created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.orders
    SET
      status = 'Cancelled',
      payment_status = 'Payment Cancelled',
      cancellation_reason = p_reason,
      cancelled_at = NOW(),
      updated_at = NOW()
    WHERE id = v_order.id
      AND status = ANY(v_stale_statuses)
      AND created_at <= p_cutoff
      AND (payment_status = ANY(v_stale_payment_statuses) OR payment_status IS NULL);

    IF FOUND THEN
      v_cancelled := v_cancelled + 1;

      IF v_order.items IS NOT NULL AND jsonb_typeof(v_order.items->'cart_items') = 'array' THEN
        FOR v_item IN
          SELECT
            COALESCE(value->>'id', value->>'productId')::UUID AS id,
            COALESCE((value->>'quantity')::INTEGER, 0) AS quantity
          FROM jsonb_array_elements(v_order.items->'cart_items')
          WHERE COALESCE(value->>'id', value->>'productId') IS NOT NULL
            AND COALESCE(value->>'id', value->>'productId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND COALESCE(value->>'quantity', '0') ~ '^[0-9]+$'
        LOOP
          IF v_item.quantity > 0 THEN
            BEGIN
              PERFORM public.record_atomic_stock_movement(
                v_item.id,
                'return',
                v_item.quantity,
                v_order.id::TEXT,
                'online_order',
                'Reverted stock due to stale unpaid order auto-cancellation',
                TRUE,
                NULL
              );
              v_restored_items := v_restored_items + 1;
            EXCEPTION WHEN OTHERS THEN
              NULL;
            END;
          END IF;
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'cancelled', v_cancelled,
    'restoredItems', v_restored_items
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_cancel_stale_orders_v1(TIMESTAMPTZ, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  issues TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF password IS NULL OR length(password) < 8 THEN
    issues := array_append(issues, 'Password must be at least 8 characters long.');
  END IF;
  IF password IS NULL OR password !~ '[A-Z]' THEN
    issues := array_append(issues, 'Password must contain an uppercase letter.');
  END IF;
  IF password IS NULL OR password !~ '[a-z]' THEN
    issues := array_append(issues, 'Password must contain a lowercase letter.');
  END IF;
  IF password IS NULL OR password !~ '[0-9]' THEN
    issues := array_append(issues, 'Password must contain a number.');
  END IF;
  IF password IS NULL OR password !~ '[^A-Za-z0-9]' THEN
    issues := array_append(issues, 'Password must contain a special character.');
  END IF;

  RETURN jsonb_build_object(
    'valid', cardinality(issues) = 0,
    'score', GREATEST(0, 5 - cardinality(issues)),
    'issues', to_jsonb(issues)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.check_otp_rate_limit(
  p_limit_key TEXT,
  p_limit_type TEXT,
  p_max_requests INTEGER DEFAULT 5,
  p_window_minutes INTEGER DEFAULT 15
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.otp_rate_limits
  WHERE requested_at < NOW() - make_interval(mins => GREATEST(COALESCE(p_window_minutes, 15), 1));

  SELECT COUNT(*)
    INTO v_count
    FROM public.otp_rate_limits
   WHERE limit_key = p_limit_key
     AND limit_type = p_limit_type
     AND requested_at >= NOW() - make_interval(mins => GREATEST(COALESCE(p_window_minutes, 15), 1));

  IF v_count >= GREATEST(COALESCE(p_max_requests, 5), 1) THEN
    RETURN jsonb_build_object('allowed', FALSE, 'count', v_count, 'remaining', 0);
  END IF;

  INSERT INTO public.otp_rate_limits(limit_key, limit_type)
  VALUES (p_limit_key, p_limit_type);

  RETURN jsonb_build_object(
    'allowed', TRUE,
    'count', v_count + 1,
    'remaining', GREATEST(COALESCE(p_max_requests, 5), 1) - v_count - 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_product_stock(
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_qty INTEGER := GREATEST(COALESCE(p_quantity, 0), 0);
BEGIN
  IF v_qty = 0 THEN
    RETURN jsonb_build_object('success', TRUE, 'quantity', 0);
  END IF;

  UPDATE public.products
     SET stock_quantity = COALESCE(stock_quantity, 0) + v_qty,
         updated_at = NOW()
   WHERE id = p_product_id;

  INSERT INTO public.inventory(product_id, stock)
  VALUES (p_product_id, v_qty)
  ON CONFLICT (product_id)
  DO UPDATE SET stock = public.inventory.stock + EXCLUDED.stock,
                updated_at = NOW();

  RETURN jsonb_build_object('success', TRUE, 'quantity', v_qty);
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_stock_with_serials(
  p_product_id UUID,
  p_quantity INTEGER,
  p_serials TEXT[] DEFAULT '{}'::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_qty INTEGER := GREATEST(COALESCE(p_quantity, 0), 0);
BEGIN
  IF v_qty = 0 THEN
    RETURN jsonb_build_object('success', TRUE, 'quantity', 0);
  END IF;

  UPDATE public.products
     SET stock_quantity = GREATEST(COALESCE(stock_quantity, 0) - v_qty, 0),
         updated_at = NOW()
   WHERE id = p_product_id;

  INSERT INTO public.inventory(product_id, stock, serial_numbers)
  VALUES (p_product_id, 0, '{}'::TEXT[])
  ON CONFLICT (product_id)
  DO UPDATE SET
    stock = GREATEST(public.inventory.stock - v_qty, 0),
    serial_numbers = COALESCE(ARRAY(
      SELECT unnest(public.inventory.serial_numbers)
      EXCEPT
      SELECT unnest(COALESCE(p_serials, '{}'::TEXT[]))
    ), '{}'::TEXT[]),
    updated_at = NOW();

  RETURN jsonb_build_object('success', TRUE, 'quantity', v_qty, 'serials', COALESCE(p_serials, '{}'::TEXT[]));
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_agent_points(
  agent_id UUID,
  points_to_add NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.sales_agents
     SET points_balance = COALESCE(points_balance, 0) + COALESCE(points_to_add, 0),
         total_points = CASE
           WHEN COALESCE(points_to_add, 0) > 0 THEN COALESCE(total_points, 0) + COALESCE(points_to_add, 0)
           ELSE COALESCE(total_points, 0)
         END,
         updated_at = NOW()
   WHERE id = agent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sales agent % not found', agent_id;
  END IF;

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.profiles
     SET role = p_role,
         updated_at = NOW()
   WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile % not found', p_user_id;
  END IF;

  INSERT INTO public.security_audit_log(user_id, action, resource, details)
  VALUES (
    auth.uid(),
    'admin_set_user_role',
    'profiles',
    jsonb_build_object('target_user_id', p_user_id, 'role', p_role, 'note', p_note)
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_customer_promotions()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  INSERT INTO public.customer_promotions(customer_id, promotion_type, title, description, status, metadata)
  SELECT
    c.id,
    'engagement',
    'Customer follow-up',
    'Generated promotion eligibility record.',
    'pending',
    jsonb_build_object('total_orders', c.total_orders, 'total_spent', c.total_spent)
  FROM public.customers c
  WHERE COALESCE(c.total_orders, 0) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_promotions cp
      WHERE cp.customer_id = c.id
        AND cp.status = 'pending'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object('success', TRUE, 'created', v_inserted);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_password_strength(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_otp_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_product_stock(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrement_stock_with_serials(UUID, INTEGER, TEXT[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_agent_points(UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_customer_promotions() TO authenticated, service_role;


-- ============================================================================
-- Source: 20260606120000_lock_inventory_rls.sql
-- ============================================================================
-- Lock down operational inventory tables that are exposed through the public schema.
-- Supabase requires RLS on exposed-schema tables; these policies keep direct
-- browser access limited to authenticated staff while server RPCs continue to
-- perform atomic stock mutations.

DO $$
BEGIN
  IF to_regclass('public.inventory') IS NOT NULL THEN
    ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS inventory_staff_select ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_insert ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_update ON public.inventory;
    DROP POLICY IF EXISTS inventory_staff_delete ON public.inventory;

    CREATE POLICY inventory_staff_select
      ON public.inventory
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_insert
      ON public.inventory
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_update
      ON public.inventory
      FOR UPDATE
      TO authenticated
      USING ((select public.is_staff_member()))
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY inventory_staff_delete
      ON public.inventory
      FOR DELETE
      TO authenticated
      USING ((select public.is_staff_member()));
  END IF;

  IF to_regclass('public.stock_movements') IS NOT NULL THEN
    ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS stock_movements_staff_select ON public.stock_movements;
    DROP POLICY IF EXISTS stock_movements_staff_insert ON public.stock_movements;

    CREATE POLICY stock_movements_staff_select
      ON public.stock_movements
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY stock_movements_staff_insert
      ON public.stock_movements
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));
  END IF;

  IF to_regclass('public.purchases') IS NOT NULL THEN
    ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS purchases_staff_select ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_insert ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_update ON public.purchases;
    DROP POLICY IF EXISTS purchases_staff_delete ON public.purchases;

    CREATE POLICY purchases_staff_select
      ON public.purchases
      FOR SELECT
      TO authenticated
      USING ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_insert
      ON public.purchases
      FOR INSERT
      TO authenticated
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_update
      ON public.purchases
      FOR UPDATE
      TO authenticated
      USING ((select public.is_staff_member()))
      WITH CHECK ((select public.is_staff_member()));

    CREATE POLICY purchases_staff_delete
      ON public.purchases
      FOR DELETE
      TO authenticated
      USING ((select public.is_staff_member()));
  END IF;
END $$;


-- ============================================================================
-- Source: 20260607000001_whatsapp_message_id_dedupe.sql
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_messages'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_messages_message_id
      ON public.whatsapp_messages (whatsapp_message_id)
      WHERE whatsapp_message_id IS NOT NULL;
  END IF;
END $$;


COMMIT;
