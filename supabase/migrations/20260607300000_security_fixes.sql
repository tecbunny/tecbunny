-- Security Fixes & Atomic Operations
-- Generated on 2026-06-07

BEGIN;

-- ============================================================================
-- 1. Token Blocklist for Superadmin Revocation
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.superadmin_token_blocklist (
  jti         UUID         PRIMARY KEY,
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_superadmin_token_blocklist_expiry ON public.superadmin_token_blocklist(expires_at);

-- Cleanup function for expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_superadmin_tokens()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  DELETE FROM public.superadmin_token_blocklist WHERE expires_at < NOW();
$$;

-- ============================================================================
-- 2. Atomic OTP Verification (Part 4 Fix)
-- ============================================================================

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
  -- Lock the specific OTP record for the duration of the transaction
  SELECT * INTO v_otp_record 
  FROM public.order_otp_verifications 
  WHERE order_id = p_order_id 
    AND customer_phone = p_customer_phone
    AND verified = FALSE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'OTP not found or already verified');
  END IF;

  -- Check expiry
  IF v_otp_record.expires_at < v_now THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'OTP has expired');
  END IF;

  -- Check attempts
  IF v_otp_record.attempts >= p_max_attempts THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Maximum verification attempts exceeded');
  END IF;

  -- Increment attempts
  UPDATE public.order_otp_verifications 
  SET attempts = attempts + 1 
  WHERE id = v_otp_record.id;

  -- Verify code
  IF v_otp_record.otp_code = p_otp_code THEN
    UPDATE public.order_otp_verifications 
    SET verified = TRUE, verified_at = v_now 
    WHERE id = v_otp_record.id;

    -- Also update the order status if needed
    UPDATE public.orders 
    SET otp_verified = TRUE, updated_at = v_now 
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', TRUE, 'verified', TRUE);
  ELSE
    RETURN jsonb_build_object(
      'success', FALSE, 
      'error', 'Invalid OTP code', 
      'attempts_left', p_max_attempts - (v_otp_record.attempts + 1)
    );
  END IF;
END;
$$;

-- ============================================================================
-- 3. Atomic Order Inventory Allocation (Part 6 Fix)
-- ============================================================================

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
  -- 1. Create the order record with pessimistic intent
  INSERT INTO public.orders (
    customer_id, 
    customer_name, 
    customer_email, 
    customer_phone,
    delivery_address,
    notes,
    payment_method,
    subtotal,
    gst_amount,
    total,
    discount_amount,
    shipping_amount,
    payment_status,
    status,
    items,
    agent_id
  ) VALUES (
    p_customer_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_delivery_address,
    p_notes,
    p_payment_method,
    p_subtotal,
    p_gst_amount,
    p_total,
    p_discount_amount,
    p_shipping_amount,
    COALESCE(p_payment_status, 'Awaiting Payment'),
    'Pending',
    p_items,
    p_agent_id
  ) RETURNING id INTO v_order_id;

  -- 2. Process items and lock stock using the specialized atomic movement function
  -- p_items is expected to be a JSONB object containing cart_items array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items->'cart_items') AS x
  LOOP
    v_product_id := (v_item.value->>'product_id')::UUID;
    -- Fallback to 'id' if 'product_id' is missing in the item object
    IF v_product_id IS NULL THEN
      v_product_id := (v_item.value->>'id')::UUID;
    END IF;
    
    v_qty := (v_item.value->>'quantity')::INTEGER;

    IF v_product_id IS NOT NULL AND v_qty > 0 THEN
      PERFORM public.record_atomic_stock_movement(
        v_product_id,
        'online_sale',
        v_qty,
        v_order_id::TEXT,
        'online_order',
        'Inventory allocated for order ' || v_order_id,
        FALSE, -- Do not allow negative stock
        p_customer_id
      );
    END IF;
  END LOOP;

  SELECT to_jsonb(o.*) INTO v_order_row FROM public.orders o WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', TRUE, 
    'order', v_order_row
  );
EXCEPTION WHEN OTHERS THEN
  -- All changes rolled back on exception
  RETURN jsonb_build_object('success', FALSE, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 4. Permissions
-- ============================================================================

-- Fix: Missing RLS policies for orders table to allow customers to view history
DROP POLICY IF EXISTS "Customers can view own orders" ON public.orders;
CREATE POLICY "Customers can view own orders" ON public.orders
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Staff can view all orders" ON public.orders;
CREATE POLICY "Staff can view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.is_staff_member());

GRANT EXECUTE ON FUNCTION public.verify_order_otp_atomic(UUID, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_order_inventory_atomic(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB, UUID
) TO authenticated;

COMMIT;
