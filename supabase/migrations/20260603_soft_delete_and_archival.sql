-- ============================================================================
-- Migration: Soft Delete Architecture & Product Archival Framework
-- File:      20260603_soft_delete_and_archival.sql
-- Purpose:   Add soft-delete columns, archival status, cascade rules, and
--            atomic stock movement RPC to public.products without destroying
--            any historical invoice, analytics, or accounting foreign keys.
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Enum for product lifecycle status
-- ────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_lifecycle_status') THEN
    CREATE TYPE product_lifecycle_status AS ENUM (
      'active',       -- Visible on storefront, purchasable
      'draft',        -- Created but not published
      'archived',     -- Soft-deleted: hidden from catalog, history preserved
      'discontinued'  -- No longer available but kept for reference
    );
  END IF;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Add soft-delete columns to public.products
--            (all are nullable / have defaults so no existing rows break)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by       UUID          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_deleted       BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archive_reason   TEXT          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMPTZ   DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS archived_by      UUID          DEFAULT NULL;

-- Backfill: mark any row already in 'archived' status as soft-deleted
UPDATE public.products
SET
  is_deleted  = TRUE,
  deleted_at  = COALESCE(updated_at, NOW()),
  archive_reason = 'Pre-migration archived status'
WHERE
  status = 'archived'
  AND is_deleted = FALSE;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 3: Filtered index – only active products in the fast-path
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_active_catalog
  ON public.products (status, created_at DESC)
  WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_products_archived
  ON public.products (archived_at DESC)
  WHERE is_deleted = TRUE;

CREATE INDEX IF NOT EXISTS idx_products_handle
  ON public.products (handle)
  WHERE is_deleted = FALSE;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Row Level Security – active catalog view (never exposes deleted)
-- ────────────────────────────────────────────────────────────────────────────

-- Public storefront: only see active, non-deleted products
DROP POLICY IF EXISTS rls_products_public_read ON public.products;
CREATE POLICY rls_products_public_read
  ON public.products
  FOR SELECT
  USING (
    is_deleted = FALSE
    AND status = 'active'
  );

-- Admin read: can see everything including archived
DROP POLICY IF EXISTS rls_products_admin_read ON public.products;
CREATE POLICY rls_products_admin_read
  ON public.products
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Admin write: only admins/managers can mutate products
DROP POLICY IF EXISTS rls_products_admin_write ON public.products;
CREATE POLICY rls_products_admin_write
  ON public.products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Safe soft-delete function
--            Marks a product as deleted WITHOUT removing the row.
--            All FK references from orders/invoices/analytics survive intact.
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.soft_delete_product(
  p_product_id   UUID,
  p_deleted_by   UUID,
  p_reason       TEXT DEFAULT 'Administrative removal'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  -- Lock the row for this transaction
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

  -- Also archive all associated variants (non-destructive)
  UPDATE public.product_variants
  SET
    status     = 'archived',
    updated_at = NOW()
  WHERE product_id = p_product_id;

  RETURN jsonb_build_object(
    'product_id',   p_product_id,
    'title',        v_product.title,
    'archived_at',  NOW(),
    'archived_by',  p_deleted_by,
    'reason',       p_reason,
    'variants_archived', (
      SELECT COUNT(*) FROM public.product_variants
      WHERE product_id = p_product_id AND status = 'archived'
    )
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Restore function (undo soft delete)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.restore_product(
  p_product_id  UUID,
  p_restored_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Restore variants
  UPDATE public.product_variants
  SET
    status     = 'active',
    updated_at = NOW()
  WHERE product_id = p_product_id;

  RETURN jsonb_build_object(
    'product_id',  p_product_id,
    'title',       v_product.title,
    'restored_at', NOW()
  );
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Atomic stock movement RPC (required by inventory/transactions)
--            Uses FOR UPDATE row-level lock to eliminate concurrent race conditions
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID          NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
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

-- Immutable audit ledger: never allow UPDATE or DELETE on stock_movements
CREATE OR REPLACE RULE stock_movements_no_update AS
  ON UPDATE TO public.stock_movements DO INSTEAD NOTHING;

CREATE OR REPLACE RULE stock_movements_no_delete AS
  ON DELETE TO public.stock_movements DO INSTEAD NOTHING;

-- Index for fast product-level ledger queries
CREATE INDEX IF NOT EXISTS idx_stock_movements_product
  ON public.stock_movements (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_movements_type
  ON public.stock_movements (movement_type, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 8: The atomic RPC that inventory/transactions/route.ts calls
-- ────────────────────────────────────────────────────────────────────────────

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

  -- ── Write immutable ledger entry ──────────────────────────────────────────
  INSERT INTO public.stock_movements (
    product_id, movement_type, quantity_delta,
    quantity_before, quantity_after,
    reference_id, reference_type, notes
  ) VALUES (
    p_product_id, p_movement_type, p_quantity,
    v_current_qty, v_new_qty,
    p_reference_id, p_reference_type,
    COALESCE(p_notes, p_movement_type || ' via system')
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

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 9: Admin convenience view – active catalog (hides soft-deleted)
-- ────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.active_products_view AS
SELECT
  p.*,
  COALESCE(p.stock_quantity, 0)            AS effective_stock,
  CASE
    WHEN COALESCE(p.stock_quantity, 0) <= 0                       THEN 'out_of_stock'
    WHEN COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_level, 5) THEN 'low_stock'
    ELSE 'in_stock'
  END                                       AS computed_stock_status
FROM public.products p
WHERE p.is_deleted = FALSE
  AND p.status     = 'active';

-- ────────────────────────────────────────────────────────────────────────────
-- SECTION 10: Archive audit log for compliance
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.product_archive_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID        NOT NULL,
  product_title TEXT,
  action       TEXT        NOT NULL CHECK (action IN ('archived', 'restored', 'permanently_deleted')),
  performed_by UUID,
  reason       TEXT,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot     JSONB       -- Full row snapshot at time of archival for forensic use
);

-- Trigger: auto-log on is_deleted change
CREATE OR REPLACE FUNCTION public.log_product_archive_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.is_deleted IS DISTINCT FROM NEW.is_deleted THEN
    INSERT INTO public.product_archive_log (
      product_id, product_title, action,
      performed_by, reason, snapshot
    ) VALUES (
      NEW.id,
      COALESCE(NEW.title, NEW.name, 'Unknown'),
      CASE WHEN NEW.is_deleted THEN 'archived' ELSE 'restored' END,
      NEW.deleted_by,
      NEW.archive_reason,
      to_jsonb(NEW)
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
-- Done.
-- Summary of what this migration deploys:
--   ✅ Soft-delete columns (is_deleted, deleted_at, deleted_by)
--   ✅ Archive tracking (archived_at, archived_by, archive_reason)
--   ✅ Filtered indexes for fast active-catalog and archive queries
--   ✅ RLS policies separating public vs admin read/write
--   ✅ soft_delete_product() and restore_product() RPC functions
--   ✅ stock_movements table with immutable ledger rules
--   ✅ record_atomic_stock_movement() RPC with FOR UPDATE locking
--   ✅ active_products_view convenience view
--   ✅ product_archive_log audit table + trigger
-- ────────────────────────────────────────────────────────────────────────────
