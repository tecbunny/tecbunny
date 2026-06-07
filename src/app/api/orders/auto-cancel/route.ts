import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient, createServiceClient , isSupabaseServiceConfigured , createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { isAtLeast, normalizeRole } from '@/lib/roles';

// export const dynamic = 'force-dynamic';

const STALE_STATUSES = ['Pending', 'Awaiting Payment'] as const;
const STALE_PAYMENT_STATUSES = [
  'Awaiting Payment',
  'Payment Confirmation Pending',
  'Pending',
  'Payment Failed',
  'Payment Cancelled'
];
const AUTO_CANCEL_REASON = 'Automatically cancelled after 24 hours without payment confirmation.';
const AUTO_CANCEL_BATCH_LIMIT = 100;

function isMissingRpcError(error: { message?: string; code?: string } | null) {
  if (!error) {
    return false;
  }

  return error.code === '42883' || /function .*auto_cancel_stale_orders_v1/i.test(error.message ?? '');
}

export async function POST(_request: NextRequest) {
  try {
    const authHeader = _request.headers.get('authorization');
    const isCron = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
    
    if (!isCron) {
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      const role = normalizeRole(profile?.role)
        ?? normalizeRole((user.app_metadata as Record<string, unknown> | undefined)?.role)
        ?? 'customer';

      if (!isAtLeast(role, 'manager')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    if (isSupabaseServiceConfigured) {
      const { data: rpcResult, error: rpcError } = await serviceClient.rpc('auto_cancel_stale_orders_v1', {
        p_cutoff: cutoffIso,
        p_limit: AUTO_CANCEL_BATCH_LIMIT,
        p_reason: AUTO_CANCEL_REASON
      });

      if (!rpcError) {
        const result = (rpcResult ?? {}) as {
          cancelled?: number;
          restoredItems?: number;
        };

        logger.info('orders_auto_cancel_success', {
          mode: 'rpc',
          cancelled: result.cancelled ?? 0,
          restoredItems: result.restoredItems ?? 0
        });

        return NextResponse.json({
          success: true,
          mode: 'rpc',
          cancelled: result.cancelled ?? 0,
          restoredItems: result.restoredItems ?? 0
        });
      }

      if (!isMissingRpcError(rpcError)) {
        logger.error('orders_auto_cancel_rpc_error', { error: rpcError.message });
        return NextResponse.json({ error: 'Failed to cancel stale orders' }, { status: 500 });
      }

      logger.warn('orders_auto_cancel_rpc_unavailable_using_fallback', { error: rpcError.message });
    }

    const { data: staleOrders, error: fetchError } = await serviceClient
      .from('orders')
      .select('id, items')
      .in('status', STALE_STATUSES)
      .lte('created_at', cutoffIso)
      .or(
        STALE_PAYMENT_STATUSES
          .map((status) => `payment_status.eq.${encodeURIComponent(status)}`)
          .concat('payment_status.is.null')
          .join(',')
      )
      .limit(AUTO_CANCEL_BATCH_LIMIT);

    if (fetchError) {
      logger.error('orders_auto_cancel_fetch_error', { error: fetchError.message });
      return NextResponse.json({ error: 'Failed to evaluate stale orders' }, { status: 500 });
    }

    if (!staleOrders || staleOrders.length === 0) {
      return NextResponse.json({ success: true, cancelled: 0 });
    }

    const staleIds = staleOrders.map((order) => order.id).filter(Boolean);
    if (staleIds.length === 0) {
      return NextResponse.json({ success: true, cancelled: 0 });
    }

    const { data: cancelledOrders, error: updateError } = await serviceClient
      .from('orders')
      .update({
        status: 'Cancelled',
        payment_status: 'Payment Cancelled',
        cancellation_reason: AUTO_CANCEL_REASON,
        updated_at: new Date().toISOString()
      })
      .in('id', staleIds)
      .in('status', STALE_STATUSES)
      .lte('created_at', cutoffIso)
      .or(
        STALE_PAYMENT_STATUSES
          .map((status) => `payment_status.eq.${encodeURIComponent(status)}`)
          .concat('payment_status.is.null')
          .join(',')
      )
      .select('id, items');

    if (updateError) {
      logger.error('orders_auto_cancel_update_error', {
        error: updateError.message,
        staleIds
      });
      return NextResponse.json({ error: 'Failed to cancel stale orders' }, { status: 500 });
    }

    const cancelledIds = new Set((cancelledOrders ?? []).map((order) => order.id));
    const skippedByRace = staleIds.length - cancelledIds.size;

    // Restore stock for cancelled orders
    let restoredCount = 0;
    for (const order of cancelledOrders ?? []) {
      const items = (order.items as any)?.cart_items || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const productId = item.id || item.productId;
          const quantity = Number(item.quantity);
          
          if (productId && quantity > 0) {
            // Attempt to restore stock using RPC
            const { error: stockError } = await serviceClient.rpc('increment_product_stock', {
              p_product_id: productId,
              p_quantity: quantity
            });

            if (stockError) {
               logger.error('orders_auto_cancel_stock_restore_error', { 
                 error: stockError.message, 
                 orderId: order.id,
                 productId 
               });
            } else {
              restoredCount++;
            }
          }
        }
      }
    }

    logger.info('orders_auto_cancel_success', {
      evaluated: staleIds.length,
      cancelled: cancelledIds.size,
      skippedByRace,
      restoredItems: restoredCount
    });
    return NextResponse.json({
      success: true,
      evaluated: staleIds.length,
      cancelled: cancelledIds.size,
      skippedByRace,
      restoredItems: restoredCount
    });
  } catch (error) {
    logger.error('orders_auto_cancel_unhandled', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
