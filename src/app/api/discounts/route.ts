import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

import { getSessionWithRole } from '@/lib/auth/server-role';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const ADMIN_ROLES = new Set(['admin', 'manager', 'superadmin']);

const ensureAdmin = (session: any, role: string | null) => {
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!role || !ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  return null;
};

const mapDiscount = (row: Record<string, any>) => ({
  id: row.id,
  name: row.name,
  type: row.type,
  value: row.value,
  status: row.status,
  start_date: row.start_date,
  expiry_date: row.expiry_date,
  min_purchase: row.min_purchase,
  applicable_category: row.applicable_category,
  applicable_product_id: row.applicable_product_id,
  priority: row.priority ?? 0,
  created_at: row.created_at,
  updated_at: row.updated_at
});

const getSupabaseForRole = (authClient: SupabaseClient, role: string | null) => {
  if (role && ADMIN_ROLES.has(role) && isSupabaseServiceConfigured) {
    return createServiceClient();
  }
  return authClient;
};

export async function GET(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);
  const errorResponse = ensureAdmin(session, role);
  if (errorResponse) {
    return errorResponse;
  }

  const supabase = getSupabaseForRole(authClient, role);

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const search = (searchParams.get('search') ?? '').trim();
    const pageParam = Number(searchParams.get('page'));
    const pageSizeParam = Number(searchParams.get('pageSize'));
    const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0
      ? Math.min(Math.floor(pageSizeParam), 100)
      : 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('discounts')
      .select('*', { count: 'exact' })
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (type) {
      query = query.eq('type', type);
    }

    if (search) {
      const sanitizedSearch = search.replace(/[%_]/g, (match) => `\\${match}`).replace(/,/g, ' ');
      const pattern = `%${sanitizedSearch}%`;
      query = query.or(
        `name.ilike.${pattern},applicable_category.ilike.${pattern},applicable_product_id.ilike.${pattern}`
      );
    }

    const { data, error, count } = await query.range(from, to);

    if (error) {
      logger.error('discounts.api.fetch_failed', { code: error.code, message: error.message });
      return NextResponse.json({ error: 'Failed to fetch discounts' }, { status: 500 });
    }

    const discounts = (data || []).map(mapDiscount);
    return NextResponse.json({
      discounts,
      count: count ?? discounts.length,
      page,
      pageSize
    });
  } catch (error) {
    logger.error('discounts.api.unexpected_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const validateDiscountPayload = (payload: Record<string, any>) => {
  const required = ['name', 'type', 'value'];
  for (const field of required) {
    if (!payload[field]) {
      return `Missing required field: ${field}`;
    }
  }

  if (!['percentage', 'fixed'].includes(payload.type)) {
    return 'Invalid discount type';
  }

  const value = Number(payload.value);
  if (!Number.isFinite(value) || value <= 0) {
    return 'Discount value must be a positive number';
  }

  return null;
};

export async function POST(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);
  const errorResponse = ensureAdmin(session, role);
  if (errorResponse) {
    return errorResponse;
  }

  const supabase = getSupabaseForRole(authClient, role);

  try {
    const payload = await request.json();
    const validationError = validateDiscountPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const parseNullableNumber = (value: any) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const record: Record<string, any> = {
      name: payload.name,
      type: payload.type,
      value: Number(payload.value),
      status: payload.status ?? 'active',
      start_date: payload.start_date ?? new Date().toISOString(),
      expiry_date: payload.expiry_date ?? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(),
      min_purchase: parseNullableNumber(payload.min_purchase),
      applicable_category: payload.applicable_category ?? null,
      applicable_product_id: payload.applicable_product_id ?? null,
      priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : 0
    };

    if (session?.user?.id) {
      record.created_by = session.user.id;
    }

    const { data, error } = await supabase
      .from('discounts')
      .insert(record)
      .select()
      .single();

    if (error) {
      logger.error('discounts.api.create_failed', { code: error.code, message: error.message, payload: record, details: error.details });
      return NextResponse.json({ error: error.message || 'Failed to create discount' }, { status: 500 });
    }

    return NextResponse.json({ discount: mapDiscount(data), message: 'Discount created successfully' }, { status: 201 });
  } catch (error) {
    logger.error('discounts.api.create_unexpected_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);
  const errorResponse = ensureAdmin(session, role);
  if (errorResponse) {
    return errorResponse;
  }

  const supabase = getSupabaseForRole(authClient, role);

  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Discount ID is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('discounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('discounts.api.update_failed', { code: error.code, message: error.message, id, updates });
      return NextResponse.json({ error: 'Failed to update discount' }, { status: 500 });
    }

    return NextResponse.json({ discount: mapDiscount(data), message: 'Discount updated successfully' });
  } catch (error) {
    logger.error('discounts.api.update_unexpected_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const { supabase: authClient, session, role } = await getSessionWithRole(request);
  const errorResponse = ensureAdmin(session, role);
  if (errorResponse) {
    return errorResponse;
  }

  const supabase = getSupabaseForRole(authClient, role);

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Discount ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('discounts.api.delete_failed', { code: error.code, message: error.message, id });
      return NextResponse.json({ error: 'Failed to delete discount' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Discount deleted successfully' });
  } catch (error) {
    logger.error('discounts.api.delete_unexpected_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
