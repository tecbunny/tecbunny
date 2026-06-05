import { NextRequest, NextResponse } from 'next/server';

import { createClient, createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { requireAdminContext } from '@/lib/auth/admin-guard';
import { generateGeminiText } from '@/lib/ai/gemini-service';
import { getSystemPrompt } from '@/lib/ai/prompts';

export async function POST(request: NextRequest) {
  try {
    const { user, role } = await requireAdminContext();

    const body = await request.json();
    const productId = body?.productId as string | undefined;
    const tone = body?.tone as string | undefined;
    const length = body?.length as string | undefined;

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 });
    }

    const supabase = isSupabaseServiceConfigured ? createServiceClient() : await createClient();

    if (!supabase) {
      return NextResponse.json({ error: 'Supabase client could not be initialized' }, { status: 500 });
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('id, title, description, category, product_type, vendor, brand, tags, specifications, price, mrp, warranty')
      .eq('id', productId)
      .single();

    if (error || !product) {
      logger.error('ai_product_description.product_fetch_failed', { error: error?.message, productId });
      return NextResponse.json({ error: 'Failed to load product details.' }, { status: 500 });
    }

    const systemPrompt = await getSystemPrompt('product_description');
    const prompt = systemPrompt
      .replace('{tone}', tone || 'professional, friendly')
      .replace('{length}', length || '120-180 words')
      .replace('{productData}', JSON.stringify({
        title: product.title,
        category: product.category,
        product_type: product.product_type,
        vendor: product.vendor,
        brand: product.brand,
        tags: product.tags,
        specifications: product.specifications,
        price: product.price,
        mrp: product.mrp,
        warranty: product.warranty,
      }, null, 2));

    const description = await generateGeminiText({
      prompt,
      temperature: 0.5,
      maxOutputTokens: 350,
    });

    const { error: updateError } = await supabase
      .from('products')
      .update({ description })
      .eq('id', productId);

    if (updateError) {
      logger.error('ai_product_description.update_failed', { error: updateError.message, productId, role, userId: user.id });
      return NextResponse.json({ error: 'Failed to update product description.' }, { status: 500 });
    }

    logger.info('ai_product_description.updated', { productId, userId: user.id, role });

    return NextResponse.json({ success: true, description });
  } catch (error) {
    logger.error('ai_product_description.error', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
