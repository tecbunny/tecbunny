-- ============================================================================
-- Migration: Record Actor in Stock Movement Ledger
-- File:      20260603160000_add_stock_movements_audit.sql
-- Purpose:   Update record_atomic_stock_movement to record the authenticated
--            user's UUID (auth.uid()) in the created_by field.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_atomic_stock_movement(
  p_product_id     UUID,
  p_movement_type  TEXT,
  p_quantity       INTEGER,
  p_reference_id   TEXT    DEFAULT NULL,
  p_reference_type TEXT    DEFAULT 'manual',
  p_notes          TEXT    DEFAULT NULL,
  p_allow_negative BOOLEAN DEFAULT FALSE
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
  -- ── Acquire row-level lock (prevents concurrent modifications) ────────────
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

  -- ── Compute new quantity ──────────────────────────────────────────────────
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
    -- transfer / unknown: no net change at source (caller handles destination)
    v_new_qty := v_current_qty;
  END IF;

  -- ── Determine new stock status ────────────────────────────────────────────
  v_new_status := CASE
    WHEN v_new_qty <= 0            THEN 'out_of_stock'
    WHEN v_new_qty <= v_min_stock  THEN 'low_stock'
    ELSE 'in_stock'
  END;

  -- ── Update products table atomically ──────────────────────────────────────
  UPDATE public.products
  SET
    stock_quantity = v_new_qty,
    stock_status   = v_new_status,
    updated_at     = NOW()
  WHERE id = p_product_id;

  -- ── Sync active product_variants (if table exists) ────────────────────────
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

  -- ── Write immutable ledger entry with auth.uid() tracking ─────────────────
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
    auth.uid()
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
