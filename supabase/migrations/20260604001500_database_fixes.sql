-- ============================================================================
-- Migration: Database Security, Reliability, Integrity, and Performance Fixes
-- File:      20260604001500_database_fixes.sql
-- ============================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────
-- 1. State Transition & Completion RPC Functions
-- ────────────────────────────────────────────────────────────────────────────

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
BEGIN
  -- Update orders table status and audit fields
  UPDATE public.orders
  SET
    status = new_status,
    payment_status = COALESCE(new_payment_status, payment_status),
    processed_by = p_processed_by,
    updated_at = NOW()
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', target_order_id;
  END IF;

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

  -- Handle cancellation auditing
  IF new_status IN ('Cancelled', 'Rejected') THEN
    UPDATE public.orders
    SET
      cancelled_at = NOW(),
      cancelled_by = p_processed_by
    WHERE id = target_order_id;
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
BEGIN
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service ticket % not found', p_ticket_id;
  END IF;

  RETURN v_total_cost;
END;
$$;

-- Restrict public execution on RPCs
REVOKE EXECUTE ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_order_status_v1(uuid, text, text, jsonb, text, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_service_ticket_v1(uuid, text, numeric, integer, text[], jsonb) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Schema Enforcements & Type Constraints
-- ────────────────────────────────────────────────────────────────────────────

-- Check Constraint for valid Lucide icons in services
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS chk_services_icon_name;
ALTER TABLE public.services ADD CONSTRAINT chk_services_icon_name 
  CHECK (icon_name IS NULL OR icon_name IN ('Wrench', 'Shield', 'Truck', 'HeadphonesIcon', 'RefreshCw', 'Award', 'Cctv', 'Cpu', 'Code'));

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Cascade-Deletion Constraints
-- ────────────────────────────────────────────────────────────────────────────

-- For order_items
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS fk_order;
ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- For order_otp_verifications
ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS fk_order;
ALTER TABLE public.order_otp_verifications DROP CONSTRAINT IF EXISTS order_otp_verifications_order_id_fkey;
ALTER TABLE public.order_otp_verifications ADD CONSTRAINT fk_order_otp FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- For sales_agent_commissions
ALTER TABLE public.sales_agent_commissions DROP CONSTRAINT IF EXISTS sales_agent_commissions_order_id_fkey;
ALTER TABLE public.sales_agent_commissions ADD CONSTRAINT fk_sales_agent_commissions_order FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Lookup Optimization Indexes
-- ────────────────────────────────────────────────────────────────────────────

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

-- ────────────────────────────────────────────────────────────────────────────
-- 5. Logging and Data Retention pg_cron Rotation Job
-- ────────────────────────────────────────────────────────────────────────────

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

COMMIT;
