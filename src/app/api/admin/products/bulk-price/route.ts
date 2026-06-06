/**
 * Bulk Price Calculation Engine
 * POST  /api/admin/products/bulk-price  – batch recalculate & persist prices
 * PATCH /api/admin/products/bulk-price  – single-product price patch
 *
 * Business Formula:
 *   Final Price = Dealer Price × 1.20 (margin) × 1.18 (GST) = Dealer Price × 1.416
 *
 * Psychological Rounding:
 *   - Round every fractional result UP to nearest .99 threshold.
 *   - If the integer part >= 100, snap to nearest X99 ceiling (e.g. 1416 → 1499).
 *   - If the integer part < 100,  snap to nearest X9  ceiling (e.g. 84.9 → 89).
 *   - MRP is auto-set to Final Price × 1.15 (15% retail buffer), same rounding rule.
 */

import { NextRequest, NextResponse } from 'next/server';

import { logger } from '@/lib/logger';
import { createServiceClient, isSupabaseServiceConfigured, createClient } from '@/lib/supabase/server';
import { getSessionWithRole } from '@/lib/auth/server-role';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

/** Combined multiplier: 20% dealer margin × 18% GST = ×1.416 */
const PRICE_MULTIPLIER = 1.416;

/** Retail MRP buffer on top of final_price */
const MRP_BUFFER = 1.15;

/** Max products processed per batch request */
const MAX_BATCH_SIZE = 500;

function getUuidAuditUserId(userId: string | undefined): string | null {
  if (!userId || userId === 'superadmin-root-id') return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)
    ? userId
    : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Psychological rounding engine
//
// Algorithm:
//   1. Compute a raw float value.
//   2. Determine the nearest ceiling "X99" or "X9" threshold.
//   3. Never round DOWN – always push to the ceiling above current value.
// ─────────────────────────────────────────────────────────────────────────────

function psychologicalCeil(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;

  if (raw >= 100) {
    // Snap to nearest *99 ceiling (e.g. 1234 → 1299, 1301 → 1399)
    const hundreds = Math.floor(raw / 100);
    const candidate = hundreds * 100 + 99;
    return raw <= candidate ? candidate : (hundreds + 1) * 100 + 99;
  } else {
    // Snap to nearest *9 ceiling for sub-₹100 prices (e.g. 45 → 49, 51 → 59)
    const tens = Math.floor(raw / 10);
    const candidate = tens * 10 + 9;
    return raw <= candidate ? candidate : (tens + 1) * 10 + 9;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core price calculation
// ─────────────────────────────────────────────────────────────────────────────

interface PriceCalculationResult {
  dealer_price: number;
  /** Raw unrounded result of dealer × 1.416 */
  raw_price: number;
  /** Psychologically rounded final selling price */
  final_price: number;
  /** MRP = final_price × 1.15, same rounding applied */
  mrp: number;
  margin_amount: number;
  gst_amount: number;
  effective_margin_pct: number;
}

function calculateProductPrice(dealerPrice: number): PriceCalculationResult {
  const dp = Math.max(0, Number(dealerPrice));
  const rawPrice = dp * PRICE_MULTIPLIER;
  const finalPrice = psychologicalCeil(rawPrice);
  const mrp = psychologicalCeil(finalPrice * MRP_BUFFER);

  // Back-calculate components for audit trail
  const priceBeforeGst = dp * 1.20;
  const gstAmount = priceBeforeGst * 0.18;
  const marginAmount = priceBeforeGst - dp;
  const effectiveMarginPct = dp > 0 ? ((finalPrice - dp) / dp) * 100 : 0;

  return {
    dealer_price: dp,
    raw_price: Math.round(rawPrice * 100) / 100,
    final_price: finalPrice,
    mrp,
    margin_amount: Math.round(marginAmount * 100) / 100,
    gst_amount: Math.round(gstAmount * 100) / 100,
    effective_margin_pct: Math.round(effectiveMarginPct * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth helper
// ─────────────────────────────────────────────────────────────────────────────

async function adminSupabase(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);

  if (!session) return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  if (!role || !ADMIN_ROLES.has(role))
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

  const supabase = isSupabaseServiceConfigured ? createServiceClient() : authClient ?? await createClient();
  return { supabase, session };
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH – Single-product price patch (manual override)
// Body: { id, title?, category?, price?, mrp?, dealer_price? }
// ─────────────────────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await adminSupabase(request);
    if ('error' in auth) return auth.error;
    const { supabase, session } = auth;

    const body = await request.json().catch(() => ({}));
    const { id, dealer_price, price, mrp, title, category, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product `id` is required' }, { status: 400 });
    }

    const updateFields: Record<string, unknown> = {};

    // Apply explicit field overrides
    if (title !== undefined)    updateFields.title = title;
    if (category !== undefined) updateFields.category = category;

    // Price calculation path: if dealer_price supplied, recalculate; else use raw price/mrp
    if (dealer_price !== undefined) {
      const calc = calculateProductPrice(Number(dealer_price));
      updateFields.price = calc.final_price;
      updateFields.mrp   = calc.mrp;
      updateFields['_price_audit'] = undefined; // strip if column absent
      logger.debug('bulk_price.single_recalc', { correlationId, id, calc });
    } else {
      if (price !== undefined) updateFields.price = psychologicalCeil(Number(price));
      if (mrp   !== undefined) updateFields.mrp   = psychologicalCeil(Number(mrp));
    }

    // Pass through any other valid fields from caller
    Object.assign(updateFields, rest);

    const auditUserId = getUuidAuditUserId(session.user.id);
    updateFields.updated_at = new Date().toISOString();
    if (auditUserId) {
      updateFields.updated_by = auditUserId;
    }

    // Remove undefined fields
    for (const k of Object.keys(updateFields)) {
      if (updateFields[k] === undefined) delete updateFields[k];
    }

    const { data, error } = await supabase
      .from('products')
      .update(updateFields)
      .eq('id', id)
      .select('id, title, price, mrp, category, updated_at')
      .single();

    if (error) {
      logger.error('bulk_price.single_update_failed', { correlationId, id, error: error.message });
      return NextResponse.json({ error: error.message, correlationId }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, correlationId });
  } catch (err: any) {
    logger.error('bulk_price.patch_unhandled', { correlationId: 'unknown', error: err.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST – Bulk recalculation stream
//
// Body option A: { items: [{ id, dealer_price }] }   → recalculate from dealer prices
// Body option B: { recalculate_all: true }            → recalculate entire catalog
//                  optional: { filter_status: 'active', filter_category: 'Networking' }
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const auth = await adminSupabase(request);
    if ('error' in auth) return auth.error;
    const { supabase, session } = auth;

    const body = await request.json().catch(() => ({}));
    const { items, recalculate_all, filter_status, filter_category, dry_run } = body;

    let sourceProducts: Array<{ id: string; price: number; dealer_price?: number }> = [];

    if (recalculate_all) {
      // ── Fetch the entire catalog (or a filtered subset) ───────────────────
      let q = supabase.from('products').select('id, title, price, mrp, category, status').limit(MAX_BATCH_SIZE);
      if (filter_status)   q = q.eq('status', filter_status);
      if (filter_category) q = q.eq('category', filter_category);

      const { data, error } = await q;
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // When recalculating all, treat current `price` as the dealer price
      sourceProducts = (data || []).map((p: any) => ({
        id: p.id,
        price: Number(p.price) || 0,
      }));
    } else if (Array.isArray(items) && items.length > 0) {
      if (items.length > MAX_BATCH_SIZE) {
        return NextResponse.json(
          { error: `Batch size exceeds limit of ${MAX_BATCH_SIZE}` },
          { status: 400 }
        );
      }
      sourceProducts = items.map((item: any) => ({
        id: item.id,
        price: Number(item.dealer_price ?? item.price) || 0,
        dealer_price: item.dealer_price,
      }));
    } else {
      return NextResponse.json(
        { error: 'Provide either `items` array or `recalculate_all: true`' },
        { status: 400 }
      );
    }

    // ── Calculate new prices for every product ──────────────────────────────
    const calculations = sourceProducts.map(p => {
      const calc = calculateProductPrice(p.price);
      return {
        id: p.id,
        dealer_price: calc.dealer_price,
        final_price: calc.final_price,
        mrp: calc.mrp,
        raw_price: calc.raw_price,
        margin_amount: calc.margin_amount,
        gst_amount: calc.gst_amount,
        effective_margin_pct: calc.effective_margin_pct,
      };
    });

    if (dry_run) {
      return NextResponse.json({
        success: true,
        dry_run: true,
        count: calculations.length,
        calculations,
        correlationId,
      });
    }

    // ── Batch upsert using individual updates (Supabase JS SDK lacks bulk UPDATE) ──
    const results: { id: string; success: boolean; error?: string }[] = [];
    const auditUserId = getUuidAuditUserId(session.user.id);

    // Process in chunks of 50 to avoid overwhelming the connection pool
    const CHUNK_SIZE = 50;
    for (let i = 0; i < calculations.length; i += CHUNK_SIZE) {
      const chunk = calculations.slice(i, i + CHUNK_SIZE);

      await Promise.all(
        chunk.map(async calc => {
          const updateFields: Record<string, unknown> = {
            price: calc.final_price,
            mrp: calc.mrp,
            updated_at: new Date().toISOString(),
          };
          if (auditUserId) {
            updateFields.updated_by = auditUserId;
          }

          const { error } = await supabase
            .from('products')
            .update(updateFields)
            .eq('id', calc.id);

          results.push({ id: calc.id, success: !error, error: error?.message });
        })
      );
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('bulk_price.batch_complete', { correlationId, successCount, failureCount });

    return NextResponse.json({
      success: true,
      summary: {
        total: calculations.length,
        updated: successCount,
        failed: failureCount,
      },
      calculations,
      failures: results.filter(r => !r.success),
      correlationId,
    });
  } catch (err: any) {
    logger.error('bulk_price.post_unhandled', { error: err.message });
    return NextResponse.json({ error: 'Internal server error', correlationId }, { status: 500 });
  }
}
