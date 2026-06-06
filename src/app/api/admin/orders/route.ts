import { NextRequest, NextResponse } from 'next/server';

import { getSessionWithRole } from '@/lib/auth/server-role';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { deserializeOrder } from '@/lib/orders/normalizers';

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);
const MIN_LIMIT = 10;
const MAX_LIMIT = 100;

// export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { supabase: authClient, session, role } = await getSessionWithRole(request);

    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!role || !ADMIN_ROLES.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured
      ? createServiceClient()
      : authClient;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10));
    const limitParam = Number.parseInt(searchParams.get('limit') ?? '20', 10);
    const limit = Number.isFinite(limitParam)
      ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limitParam))
      : 20;
    const offset = (page - 1) * limit;
    const typeFilter = searchParams.get('type');
    const statusFilter = searchParams.get('status');
    const searchTerm = searchParams.get('search');

    let query = supabase
      .from('orders')
      .select(
        [
          'id',
          'customer_id',
          'customer_name',
          'customer_email',
          'customer_phone',
          'status',
          'type',
          'subtotal',
          'gst_amount',
          'discount_amount',
          'shipping_amount',
          'total',
          'delivery_address',
          'pickup_store',
          'notes',
          'payment_method',
          'payment_status',
          'payment_reference',
          'items',
          'created_at',
          'updated_at'
        ].join(', '),
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (typeFilter && typeFilter !== 'all') {
      query = query.eq('type', typeFilter);
    }

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }

    if (searchTerm) {
      const normalized = `%${searchTerm}%`;
      query = query.or(
        `customer_name.ilike.${normalized},customer_email.ilike.${normalized},customer_phone.ilike.${normalized}`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      logger.error('admin_orders.fetch_failed', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 });
    }

    const orders = (data ?? []).map(deserializeOrder);
    const total = count ?? orders.length;
    const pages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    });
  } catch (error) {
    logger.error('admin_orders.unexpected_error', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
