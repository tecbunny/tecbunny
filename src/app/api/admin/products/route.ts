import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { isAdmin, isSuperadminSession } from '@/lib/permissions';
import { logger } from '@/lib/logger';
import { getProductDisplayImage } from '@/lib/image-utils';
export { POST, PUT } from '@/app/api/products/route';

// export const dynamic = 'force-dynamic';

const MAX_LIMIT = 250;

function cleanSearchText(value: string | null | undefined, maxLength = 80) {
  if (!value) return '';
  return value
    .trim()
    .replace(/[%_*]/g, '')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, maxLength);
}

async function resolveProductColumns(supabase: any): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_name', 'products');

    if (error) {
      logger.warn('admin_products.column_lookup_failed', { error: error.message });
      return new Set();
    }

    return new Set((data || []).map((column: any) => column.column_name));
  } catch (error) {
    logger.warn('admin_products.column_lookup_exception', { error });
    return new Set();
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    const isSuperadmin = await isSuperadminSession();

    if ((userError || !user) && !isSuperadmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isSuperadmin && !(await isAdmin(user))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = isSupabaseServiceConfigured ? createServiceClient() : await createClient();
    
    const searchParams = new URL(request.url).searchParams;
    const search = cleanSearchText(searchParams.get('search'));
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const limitParam = parseInt(searchParams.get('limit') || '100', 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 100;

    const availableColumns = await resolveProductColumns(serviceClient);

    let query = serviceClient
      .from('products')
      .select('*')
      .limit(limit);

  const primarySortColumn = availableColumns.has('title') ? 'title' : (availableColumns.has('name') ? 'name' : 'created_at');
  query = query.order(primarySortColumn, { ascending: true, nullsFirst: false });

    if (!includeInactive && availableColumns.has('status')) {
      query = query.eq('status', 'active');
    }

    if (search) {
      if (availableColumns.has('title')) {
        query = query.ilike('title', `%${search}%`);
      } else if (availableColumns.has('name')) {
        query = query.ilike('name', `%${search}%`);
      } else if (availableColumns.has('description')) {
        query = query.ilike('description', `%${search}%`);
      }
    }

    const { data: products, error } = await query;

    if (error) {
      logger.error('admin_products.fetch_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    const normalized = (products || []).map((product: any) => ({
      ...product,
      title: product.title ?? product.name ?? 'Untitled product',
      name: product.name ?? product.title ?? 'Untitled product',
      price: product.price ?? 0,
      category: product.category ?? 'Uncategorized',
      image: getProductDisplayImage(product) || product.image || null
    }));

    return NextResponse.json({ products: normalized });
  } catch (error) {
    logger.error('admin_products.unexpected_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
