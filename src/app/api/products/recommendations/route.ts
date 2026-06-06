import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getProductDisplayImage } from '@/lib/image-utils';
import { filterPubliclyVisibleProducts } from '@/lib/product-visibility';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');
  
  // Get User
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId && !sessionId) {
    return NextResponse.json({ recentlyViewed: [], recommended: [] });
  }

  // 1. Fetch Recent Views
  let query = supabase
    .from('analytics_events')
    .select('resource_id, metadata')
    .eq('event_type', 'product_view')
    .order('created_at', { ascending: false })
    .limit(10);

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (sessionId) {
    query = query.eq('session_id', sessionId);
  }

  const { data: events } = await query;

  if (!events || events.length === 0) {
    return NextResponse.json({ recentlyViewed: [], recommended: [] });
  }

  // Extract Product IDs and Categories
  const viewedProductIds = [...new Set(events.map(e => e.resource_id).filter(Boolean))];
  
  // 2. Fetch Viewed Products Details
  const { data: viewedProducts } = await supabase
    .from('products')
    .select('*')
    .in('id', viewedProductIds)
    .eq('status', 'active');

  if (!viewedProducts || viewedProducts.length === 0) {
    return NextResponse.json({ recentlyViewed: [], recommended: [] });
  }

  const visibleViewedProducts = filterPubliclyVisibleProducts(viewedProducts);

  if (visibleViewedProducts.length === 0) {
    return NextResponse.json({ recentlyViewed: [], recommended: [] });
  }

  // 3. Find Categories/Types to Recommend
  const categories = [...new Set(visibleViewedProducts.map(p => p.category).filter(Boolean))];
  const types = [...new Set(visibleViewedProducts.map(p => p.product_type).filter(Boolean))];

  // 4. Fetch Recommendations (Same Category/Type, excluding viewed)
  let recommendationQuery = supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .not('id', 'in', `(${viewedProductIds.join(',')})`)
    .limit(8);

  if (categories.length > 0) {
    recommendationQuery = recommendationQuery.in('category', categories);
  } else if (types.length > 0) {
    recommendationQuery = recommendationQuery.in('product_type', types);
  } else {
    // Fallback to popular if no specific category info
    recommendationQuery = recommendationQuery.order('popularity', { ascending: false });
  }

  const { data: recommendedProducts } = await recommendationQuery;
  const visibleRecommendedProducts = filterPubliclyVisibleProducts(recommendedProducts || []);

  const normalizedViewed = visibleViewedProducts.map(p => ({
    ...p,
    image: getProductDisplayImage(p) || p.image || null
  }));

  const normalizedRecommended = visibleRecommendedProducts.map(p => ({
    ...p,
    image: getProductDisplayImage(p) || p.image || null
  }));

  return NextResponse.json({
    recentlyViewed: normalizedViewed,
    recommended: normalizedRecommended
  });
}
