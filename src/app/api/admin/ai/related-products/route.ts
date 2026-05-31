import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { requireAdminContext } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

const scoreProduct = (tokens: string[], product: Record<string, unknown>) => {
  const haystack = [
    product.title,
    product.description,
    product.category,
    product.product_type,
    product.vendor,
    product.brand,
    Array.isArray(product.tags) ? (product.tags as string[]).join(' ') : product.tags,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  let score = 0;
  for (const token of tokens) {
    if (!token) continue;
    if (haystack.includes(token)) score += 2;
  }
  return score;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminContext();

    const body = await request.json();
    const requirement = String(body?.requirement || '').trim();
    const limit = Math.min(Number(body?.limit || 6), 12);

    if (!requirement) {
      return NextResponse.json({ error: 'Requirement text is required.' }, { status: 400 });
    }

    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client could not be initialized' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, title, description, category, product_type, vendor, brand, tags, price, mrp, image');

    if (error) {
      logger.error('ai_related_products.fetch_failed', { error: error.message });
      return NextResponse.json({ error: 'Failed to load products.' }, { status: 500 });
    }

    const tokens = tokenize(requirement);
    const scored = (data || [])
      .map((product: any) => ({
        product,
        score: scoreProduct(tokens, product),
      }))
      .filter(entry => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(entry => entry.product);

    return NextResponse.json({
      success: true,
      requirement,
      items: scored,
    });
  } catch (error) {
    logger.error('ai_related_products.error', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
