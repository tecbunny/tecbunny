import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { isAtLeast } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
import { computeAutoFill } from '@/lib/homepage-auto-fill';

// export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Allow invocation by the site manager OR by a scheduled cron using a secret header
    const secretHeader = request.headers.get('x-auto-fill-secret');
    const cronSecret = process.env.AUTO_FILL_SECRET || '';
    const isCronRequest = typeof secretHeader === 'string' && secretHeader.trim().length > 0 && secretHeader === cronSecret;

    // If not a cron request, require authenticated manager
    let role: UserRole = 'customer';
    if (!isCronRequest) {
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      role = (profile?.role as UserRole | undefined)
      ?? ((user.app_metadata as Record<string, unknown> | undefined)?.role as UserRole | undefined)
      ?? 'customer';
      }

    if (!isCronRequest && !isAtLeast(role, 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 15)));
    const days = Math.max(1, Math.min(365, Number(body?.days ?? 30)));

    

    // Fetch active products and recent orders similarly to auto-fill route
    const { data: products } = await supabase.from('products').select('id, title, name, images, price, offer_price, popularity, rating, review_count, created_at, prioritized, product_type').eq('status', 'active');

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders } = await supabase.from('orders').select('items').gte('created_at', cutoff);

    const salesCountMap = new Map<string, number>();
    for (const order of (recentOrders || [])) {
      const items = Array.isArray(order?.items) ? order.items : (order?.items?.cart_items || []);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        const pid = item.productId || item.product_id || item.id || (item as any).productId;
        if (!pid) continue;
        salesCountMap.set(pid, (salesCountMap.get(pid) || 0) + Number(item.quantity || 1));
      }
    }

    // Fetch analytics data for AI scoring
    const analyticsMap = new Map<string, any>();
    try {
      const { data: analyticsData } = await supabase.from('product_analytics_view').select('*');
      if (analyticsData) {
        analyticsData.forEach((item: any) => {
          analyticsMap.set(item.id, item);
        });
      }
    } catch (err) {
      logger.warn('Failed to fetch analytics for auto-fill', { err });
    }

    const allProducts = (products || []).map(p => ({
      id: p.id,
      title: p.title ?? p.name ?? p.id,
      name: p.name ?? p.title ?? p.id,
      price: (p as any).price ?? 0,
      description: (p as any).description ?? '',
      category: (p as any).category ?? 'Uncategorized',
      image: (p as any).image ?? (Array.isArray((p as any).images) ? (p as any).images[0] : '') ?? '',
      images: (p as any).images ?? [],
      popularity: (p as any).popularity ?? 0,
      rating: (p as any).rating ?? 0,
      reviewCount: (p as any).review_count ?? (p as any).reviewCount ?? 0,
      created_at: (p as any).created_at ?? new Date().toISOString(),
      prioritized: !!(p as any).prioritized,
      product_type: (p as any).product_type,
      offer_price: (p as any).offer_price,
      mrp: (p as any).mrp,
      // preserve other fields if present
      ...(p as any),
    } as any));
    const suggestions = computeAutoFill(allProducts, salesCountMap, { limit, analyticsData: analyticsMap });

    // Persist suggestions to settings
    const serviceUpsert = async (key: string, values: string[]) => {
      try {
        await supabase.from('settings').upsert({ key, value: JSON.stringify(values) }, { onConflict: 'key' });
      } catch (err) {
        logger.warn('auto_fill_upsert_failed', { key, err: (err as any)?.message || String(err) });
      }
    };

    await serviceUpsert('featuredProductIds', suggestions.featured.map(p => p.id));
    await serviceUpsert('newArrivalProductIds', suggestions.newArrivals.map(p => p.id));
    await serviceUpsert('trendingProductIds', suggestions.trending.map(p => p.id));
    await serviceUpsert('dealProductIds', suggestions.deals.map(p => p.id));

    logger.info('admin_homepage_autofill_persisted', { by: user?.id ?? (isCronRequest ? 'cron' : undefined), counts: { featured: suggestions.featured.length, newArrivals: suggestions.newArrivals.length, trending: suggestions.trending.length, deals: suggestions.deals.length } });

    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    logger.error('admin_homepage_autofill_run_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
