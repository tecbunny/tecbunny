import { NextRequest, NextResponse } from 'next/server';

import { createClient as createServerClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { isAtLeast } from '@/lib/roles';
import type { UserRole } from '@/lib/types';
// computeAutoFill is not used in this route; we compute inline for return.

// export const dynamic = 'force-dynamic';

interface AutoFillOptions {
  limit?: number;
  days?: number; // for trending
}

// POST /api/admin/homepage/auto-fill
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    // Use service client for product/order reads so RLS doesn't restrict catalog access
    const dataClient = isSupabaseServiceConfigured ? createServiceClient() : supabase;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile?.role as UserRole | undefined)
      ?? ((user.app_metadata as Record<string, unknown> | undefined)?.role as UserRole | undefined)
      ?? 'customer';

    if (!isAtLeast(role, 'manager')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({})) as AutoFillOptions;
    const limit = Math.max(1, Math.min(50, Number(body?.limit ?? 15)));
    const days = Math.max(1, Math.min(365, Number(body?.days ?? 30)));

    

    // 1) Fetch active products with relevant fields
    const { data: products } = await dataClient
      .from('products')
      .select('id, title, name, images, price, offer_price, popularity, rating, review_count, created_at, prioritized, product_type')
      .eq('status', 'active');

    // productMap not used; can be removed to satisfy linter

    // 2) Trending: aggregate sold quantities in last `days` days
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentOrders } = await dataClient
      .from('orders')
      .select('items')
      .gte('created_at', cutoff);

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

    // Build base array
    const allProducts = (products || []).map(p => ({ ...p }));

    // Compute scores for trending
    const trendingSorted = [...allProducts]
      .map(p => ({
        product: p,
        sales: salesCountMap.get(p.id) || 0,
        score: ((salesCountMap.get(p.id) || 0) * 0.7) + ((p.popularity || 0) * 0.2) + ((p.rating || 0) * 0.1)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(x => x.product);

    // New arrivals: recently created
    const newArrivals = [...allProducts]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);

    // Deals: highest discount first, fall back to popularity
    const deals = [...allProducts]
      .filter(p => (typeof p.offer_price === 'number' && p.offer_price < p.price) || (p as any).discount_percentage > 0)
      .sort((a, b) => {
        const ad = ((a.price || 0) - (a.offer_price || a.price || 0));
        const bd = ((b.price || 0) - (b.offer_price || b.price || 0));
        if (bd !== ad) return bd - ad;
        return (b.popularity || 0) - (a.popularity || 0);
      })
      .slice(0, limit);

    // Featured: prioritize explicit 'prioritized' flags, then popularity
    const featured = [...allProducts]
      .sort((a, b) => {
        const ap = a.prioritized ? 1 : 0;
        const bp = b.prioritized ? 1 : 0;
        if (ap !== bp) return bp - ap;
        if ((b.popularity || 0) !== (a.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
        if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
      .slice(0, limit);

    // Return computed lists also for external use.
    return NextResponse.json({ success: true, featured, newArrivals, trending: trendingSorted, deals });

  } catch (error) {
    logger.error('admin_homepage_autofill_error', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
