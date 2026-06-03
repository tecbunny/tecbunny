-- ============================================================================
-- Migration: Security, Performance, and Integrity Audit Improvements
-- File:      20260603160000_audit_and_security_improvements.sql
-- ============================================================================

-- ── 1. DROP OLD STOCK MOVEMENT RPC FUNCTION TO AVOID OVERLOAD OVERLAPS ──
DROP FUNCTION IF EXISTS public.record_atomic_stock_movement(UUID, TEXT, INTEGER, TEXT, TEXT, TEXT, BOOLEAN);

-- ── 2. REDEFINE ATOMIC STOCK MOVEMENT RPC WITH ACTOR (p_created_by) SUPPORT ──
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
SET search_path = public
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
  -- Acquire row-level lock (prevents concurrent modifications)
  SELECT
    COALESCE(stock_quantity, 0),
    COALESCE(min_stock_level, 5)
  INTO v_current_qty, v_min_stock
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product % not found', p_product_id
      USING ERRCODE = 'P0002';
  END IF;

  -- Compute new quantity
  IF p_movement_type = ANY(v_inbound) THEN
    v_new_qty := v_current_qty + p_quantity;

  ELSIF p_movement_type = ANY(v_outbound) THEN
    v_new_qty := v_current_qty - p_quantity;
    IF v_new_qty < 0 AND NOT p_allow_negative THEN
      RAISE EXCEPTION 'Insufficient stock: current=%, requested=%, product=%',
        v_current_qty, p_quantity, p_product_id
        USING ERRCODE = 'P0001';
    END IF;

  ELSIF p_movement_type = 'adjustment' THEN
    -- Absolute physical count override
    v_new_qty := p_quantity;

  ELSE
    -- transfer / unknown: no net change at source
    v_new_qty := v_current_qty;
  END IF;

  -- Determine new stock status
  v_new_status := CASE
    WHEN v_new_qty <= 0            THEN 'out_of_stock'
    WHEN v_new_qty <= v_min_stock  THEN 'low_stock'
    ELSE 'in_stock'
  END;

  -- Update products table atomically
  UPDATE public.products
  SET
    stock_quantity = v_new_qty,
    stock_status   = v_new_status,
    updated_at     = NOW()
  WHERE id = p_product_id;

  -- Sync active product_variants (if table exists)
  BEGIN
    UPDATE public.product_variants
    SET
      inventory_quantity = v_new_qty,
      updated_at         = NOW()
    WHERE product_id = p_product_id
      AND status = 'active';
  EXCEPTION WHEN undefined_table THEN
    NULL; -- Table doesn't exist yet; skip silently
  END;

  -- Write immutable ledger entry (explicitly passing p_created_by or auth.uid())
  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity_delta,
    quantity_before, quantity_after,
    reference_id, reference_type, notes,
    created_by
  ) VALUES (
    p_product_id, p_movement_type, p_quantity,
    v_current_qty, v_new_qty,
    p_reference_id, p_reference_type,
    COALESCE(p_notes, p_movement_type || ' via system'),
    COALESCE(p_created_by, auth.uid())
  )
  RETURNING id INTO v_movement_id;

  RETURN jsonb_build_object(
    'movement_id',     v_movement_id,
    'quantity_before', v_current_qty,
    'quantity_after',  v_new_qty,
    'delta',           v_new_qty - v_current_qty,
    'stock_status',    v_new_status
  );
END;
$$;

-- ── 3. SECURITY DEFINER STAFF CHECK FUNCTIONS TO PREVENT RLS RECURSION ──
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

REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.is_staff_member() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_member() TO authenticated;

-- ── 4. REAPPLY RLS PRODUCTS ADMIN POLICIES WITH RECURSION-SAFE ASSIGNMENTS ──
DROP POLICY IF EXISTS rls_products_admin_read ON public.products;
CREATE POLICY rls_products_admin_read
  ON public.products
  FOR SELECT
  USING (
    public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS rls_products_admin_write ON public.products;
CREATE POLICY rls_products_admin_write
  ON public.products
  FOR ALL
  USING (
    public.is_manager_or_admin()
  );

-- ── 5. DEPLOY OPTIMIZED INDEXES FOR HIGH-TRAFFIC SCAN PATTERNS ──
CREATE INDEX IF NOT EXISTS idx_orders_active_created
  ON public.orders (created_at DESC) 
  WHERE status != 'Cancelled' AND status != 'Rejected';

CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at
  ON public.stock_movements (created_at DESC);

-- ── 6. RESTRUCTURE FOREIGN KEY CASCADE BEHAVIOR ON QUOTES TABLE ──
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_user_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ── 7. STRENGTHEN WEBHOOK IDEMPOTENCY LOGGING STRUCTURE ──
ALTER TABLE public.webhook_events ADD COLUMN IF NOT EXISTS event_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_event_id ON public.webhook_events(event_id);

-- ── 8. DEPLOY DATABASE-SIDE ANALYTICS TOP-PRODUCT AGGREGATION RPC ──
CREATE OR REPLACE FUNCTION public.get_top_products(p_start_date TIMESTAMPTZ, p_limit INTEGER)
RETURNS TABLE (resource_id TEXT, count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT resource_id, COUNT(*) as count
  FROM public.analytics_events
  WHERE event_type = 'product_view'
    AND resource_id IS NOT NULL
    AND created_at >= p_start_date
  GROUP BY resource_id
  ORDER BY count DESC
  LIMIT p_limit;
$$;

REVOKE EXECUTE ON FUNCTION public.get_top_products(TIMESTAMPTZ, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_top_products(TIMESTAMPTZ, INTEGER) TO authenticated;
