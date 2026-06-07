/**
 * Atomic Inventory Transaction Engine
 * POST   /api/inventory/transactions  – record a movement (warehouse receipt or sale)
 * PUT    /api/inventory/transactions  – absolute quantity override (physical count)
 * GET    /api/inventory/transactions  – ledger query with pagination
 *
 * Race Condition Prevention:
 *   All quantity mutations are performed via PostgreSQL RPC functions that use
 *   row-level locking (FOR UPDATE) and COALESCE defaults inside an ACID transaction.
 *   The Node.js layer NEVER reads then writes – it delegates the math to the DB.
 *
 * Channel distinction:
 *   - movement_type = 'purchase_receipt'  → Bulk warehouse check-in
 *   - movement_type = 'walk_in_sale'      → Serialized counter sale (decrements stock)
 *   - movement_type = 'online_sale'       → E-commerce order fulfilment
 *   - movement_type = 'adjustment'        → Physical count correction
 *   - movement_type = 'return'            → Customer return / restocking
 *   - movement_type = 'transfer'          → Inter-warehouse movement
 */

import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logger';
import { requireApiRole } from '@/lib/server-role-guard';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';

// ─────────────────────────────────────────────────────────────────────────────
// Movement type definitions
// ─────────────────────────────────────────────────────────────────────────────

const MOVEMENT_TYPES = [
  'purchase_receipt',  // +qty  Warehouse bulk shipment check-in
  'walk_in_sale',      // -qty  Physical counter sale (serialized item checkout)
  'online_sale',       // -qty  E-commerce order drawdown
  'adjustment',        // =qty  Absolute physical count correction
  'return',            // +qty  Customer return / restocking
  'transfer',          // ±qty  Inter-warehouse or branch movement
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Input schema
// ─────────────────────────────────────────────────────────────────────────────

const movementSchema = z.object({
  product_id: z.string().uuid('product_id must be a valid UUID'),
  movement_type: z.enum(MOVEMENT_TYPES),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  /** For walk_in_sale: array of serial numbers being checked out */
  serial_numbers: z.array(z.string()).optional(),
  /** Order ID, PO number, invoice number – used for audit cross-referencing */
  reference_id: z.string().optional(),
  reference_type: z.enum([
    'purchase_order',
    'sales_order',
    'walk_in_invoice',
    'return_order',
    'transfer_order',
    'manual',
    'api_adjustment',
  ]).optional().default('manual'),
  notes: z.string().max(500).optional(),
  /** For transfer: target location */
  target_location: z.string().optional(),
  /** Allow stock to go negative (only for trusted admin overrides) */
  allow_negative: z.boolean().optional().default(false),
});

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * The PostgreSQL RPC this route expects to exist.
 * This SQL is already deployed by migration 20260603_soft_delete_and_archival.sql.
 * Shown here for reference only — do NOT run this separately.
 *
 * CREATE OR REPLACE FUNCTION record_atomic_stock_movement(
 *   p_product_id     UUID,
 *   p_movement_type  TEXT,
 *   p_quantity       INTEGER,
 *   p_reference_id   TEXT    DEFAULT NULL,
 *   p_reference_type TEXT    DEFAULT 'manual',
 *   p_notes          TEXT    DEFAULT NULL,
 *   p_allow_negative BOOLEAN DEFAULT FALSE
 * ) RETURNS JSONB
 * LANGUAGE plpgsql
 * SECURITY DEFINER
 * AS $$
 * DECLARE
 *   v_current_qty  INTEGER;
 *   v_new_qty      INTEGER;
 *   v_movement_id  UUID;
 *   v_inbound      TEXT[] := ARRAY['purchase_receipt', 'return'];
 *   v_outbound     TEXT[] := ARRAY['walk_in_sale', 'online_sale'];
 * BEGIN
 *   -- Acquire row-level lock to prevent concurrent race conditions
 *   SELECT COALESCE(stock_quantity, 0)
 *     INTO v_current_qty
 *     FROM products
 *    WHERE id = p_product_id
 *      FOR UPDATE;
 *
 *   IF NOT FOUND THEN
 *     RAISE EXCEPTION 'Product % not found', p_product_id;
 *   END IF;
 *
 *   -- Calculate new quantity based on movement type
 *   IF p_movement_type = ANY(v_inbound) THEN
 *     v_new_qty := v_current_qty + p_quantity;
 *   ELSIF p_movement_type = ANY(v_outbound) THEN
 *     v_new_qty := v_current_qty - p_quantity;
 *     IF v_new_qty < 0 AND NOT p_allow_negative THEN
 *       RAISE EXCEPTION 'Insufficient stock: current=%, requested=%', v_current_qty, p_quantity;
 *     END IF;
 *   ELSIF p_movement_type = 'adjustment' THEN
 *     v_new_qty := p_quantity;  -- absolute override
 *   ELSE
 *     v_new_qty := v_current_qty;  -- transfer: caller handles location logic separately
 *   END IF;
 *
 *   -- Update main product stock atomically
 *   UPDATE products
 *      SET stock_quantity = v_new_qty,
 *          stock_status   = CASE
 *                             WHEN v_new_qty <= 0                        THEN 'out_of_stock'
 *                             WHEN v_new_qty <= COALESCE(min_stock_level,5) THEN 'low_stock'
 *                             ELSE 'in_stock'
 *                           END,
 *          updated_at     = NOW()
 *    WHERE id = p_product_id;
 *
 *   -- Sync active variants
 *   UPDATE product_variants
 *      SET inventory_quantity = v_new_qty, updated_at = NOW()
 *    WHERE product_id = p_product_id AND status = 'active';
 *
 *   -- Write immutable audit ledger entry
 *   INSERT INTO stock_movements (
 *     product_id, movement_type, quantity_delta,
 *     quantity_before, quantity_after, reference_id, reference_type, notes
 *   ) VALUES (
 *     p_product_id, p_movement_type, p_quantity,
 *     v_current_qty, v_new_qty, p_reference_id, p_reference_type,
 *     COALESCE(p_notes, p_movement_type || ' via system')
 *   ) RETURNING id INTO v_movement_id;
 *
 *   RETURN jsonb_build_object(
 *     'movement_id',     v_movement_id,
 *     'quantity_before', v_current_qty,
 *     'quantity_after',  v_new_qty,
 *     'delta',           v_new_qty - v_current_qty
 *   );
 * END;
 * $$;
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST – Record a stock movement
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const access = await requireApiRole({ allowedRoles: ['sales', 'manager'], minimumRole: 'admin' });
    if ('error' in access) return access.error;
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : access.supabase;

    const body = await request.json().catch(() => ({}));
    const validation = movementSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.format(), correlationId },
        { status: 400 }
      );
    }

    const {
      product_id,
      movement_type,
      quantity,
      serial_numbers,
      reference_id,
      reference_type,
      notes,
      allow_negative,
    } = validation.data;

    logger.info('inventory.transaction.start', {
      correlationId, product_id, movement_type, quantity,
      serials: serial_numbers?.length,
    });

    // ── Validate serial numbers for walk-in sales ─────────────────────────────
    if (movement_type === 'walk_in_sale' && serial_numbers && serial_numbers.length > 0) {
      if (serial_numbers.length !== quantity) {
        return NextResponse.json(
          {
            error: `Serial number count (${serial_numbers.length}) must match quantity (${quantity}) for walk_in_sale`,
            correlationId,
          },
          { status: 400 }
        );
      }
    }

    // ── Call atomic PostgreSQL RPC (eliminates race conditions) ───────────────
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'record_atomic_stock_movement',
      {
        p_product_id:     product_id,
        p_movement_type:  movement_type,
        p_quantity:       quantity,
        p_reference_id:   reference_id || null,
        p_reference_type: reference_type,
        p_notes:          notes || `${movement_type} via API`,
        p_allow_negative: allow_negative,
        p_created_by:     access.session?.user.id || null,
      }
    );

    if (rpcError) {
      logger.error('inventory.transaction.rpc_failed', {
        correlationId, error: rpcError.message, code: rpcError.code,
      });

      // RPC is required so stock updates remain atomic under concurrent requests.
      logger.warn('inventory.transaction.rpc_required', { correlationId });

      return NextResponse.json(
        {
          error: 'Atomic stock movement failed',
          details: rpcError.message,
          correlationId,
        },
        { status: 409, headers: { 'x-correlation-id': correlationId } }
      );

    }

    // ── RPC succeeded ─────────────────────────────────────────────────────────
    const result = rpcResult as {
      movement_id: string;
      quantity_before: number;
      quantity_after: number;
      delta: number;
    };

    logger.info('inventory.transaction.success', {
      correlationId, product_id, movement_type,
      before: result.quantity_before, after: result.quantity_after,
    });

    return NextResponse.json({
      success: true,
      method: 'atomic_rpc',
      movement_id: result.movement_id,
      quantity_before: result.quantity_before,
      quantity_after: result.quantity_after,
      delta: result.delta,
      correlationId,
    }, { headers: { 'x-correlation-id': correlationId } });

  } catch (err: any) {
    logger.error('inventory.transaction.unhandled', { correlationId, error: err.message });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUT – Absolute physical count override (full physical stocktake result)
// Body: { product_id, new_quantity, notes?, reference_id? }
// ─────────────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const access = await requireApiRole({ allowedRoles: [], minimumRole: 'admin' });
    if ('error' in access) return access.error;
    const supabase = isSupabaseServiceConfigured ? createServiceClient() : access.supabase;

    const { product_id, new_quantity, notes, reference_id } = await request.json().catch(() => ({}));

    if (!product_id || new_quantity === undefined) {
      return NextResponse.json(
        { error: 'product_id and new_quantity are required', correlationId },
        { status: 400 }
      );
    }

    const qty = Math.max(0, parseInt(new_quantity, 10));

    // Use the atomic RPC with movement_type = 'adjustment'
    const { data: rpcResult, error } = await supabase.rpc('record_atomic_stock_movement', {
      p_product_id:     product_id,
      p_movement_type:  'adjustment',
      p_quantity:       qty,
      p_reference_id:   reference_id || null,
      p_reference_type: 'manual',
      p_notes:          notes || 'Physical stocktake adjustment',
      p_allow_negative: false,
      p_created_by:     access.session?.user.id || null,
    });

    if (error) {
      logger.warn('inventory.absolute_override.rpc_failed', { correlationId, error: error.message });

      return NextResponse.json(
        {
          error: 'Atomic stock adjustment failed',
          details: error.message,
          correlationId,
        },
        { status: 409, headers: { 'x-correlation-id': correlationId } }
      );

    }

    return NextResponse.json({
      success: true,
      new_quantity: qty,
      method: 'atomic_rpc',
      ...rpcResult,
      correlationId,
    });
  } catch (_err: any) {
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}
// ?product_id=&movement_type=&limit=50&page=1&date_from=&date_to=
// ─────────────────────────────────────────────────────────────────────────────

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id })).toString('base64');
}

function decodeCursor(cursorStr: string): { createdAt: string; id: string } | null {
  try {
    const json = JSON.parse(Buffer.from(cursorStr, 'base64').toString('utf-8'));
    if (json && typeof json.createdAt === 'string' && typeof json.id === 'string') {
      return json;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const access = await requireApiRole({ allowedRoles: ['sales', 'manager'], minimumRole: 'admin' });
    if ('error' in access) return access.error;
    const { supabase } = access;

    const { searchParams } = new URL(request.url);
    const product_id    = searchParams.get('product_id');
    const movement_type = searchParams.get('movement_type');
    const limit         = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const date_from     = searchParams.get('date_from');
    const date_to       = searchParams.get('date_to');
    const cursorParam   = searchParams.get('cursor');

    let q = supabase
      .from('stock_movements')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false });

    if (product_id)    q = q.eq('product_id', product_id);
    if (movement_type) q = q.eq('movement_type', movement_type);
    if (date_from)     q = q.gte('created_at', date_from);
    if (date_to)       q = q.lte('created_at', date_to);

    if (cursorParam) {
      const cursor = decodeCursor(cursorParam);
      if (cursor) {
        q = q.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
      }
      q = q.limit(limit + 1);
    } else {
      const page = Math.max(parseInt(searchParams.get('page') || '1'), 1);
      const offset = (page - 1) * limit;
      q = q.range(offset, offset + limit);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
    }

    const hasNextPage = (data || []).length > limit;
    const pageData = hasNextPage ? (data || []).slice(0, limit) : (data || []);
    
    let nextCursor: string | null = null;
    if (hasNextPage && pageData.length > 0) {
      const lastItem = pageData[pageData.length - 1];
      nextCursor = encodeCursor(lastItem.created_at, lastItem.id);
    }

    return NextResponse.json({
      success: true,
      data: pageData,
      pagination: {
        limit,
        next_cursor: nextCursor,
        has_next: hasNextPage,
        page: cursorParam ? undefined : Math.max(parseInt(searchParams.get('page') || '1'), 1)
      },
      correlationId,
    });
  } catch (_err: any) {
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}
