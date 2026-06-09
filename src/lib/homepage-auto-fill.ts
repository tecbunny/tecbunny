import type { Product } from './types';

export type AutoFillResult = {
  featured: Product[];
  newArrivals: Product[];
  trending: Product[];
  deals: Product[];
};

export function computeAutoFill(
  productsList: Product[],
  salesCounts: Map<string, number>,
  options?: { limit?: number; analyticsData?: Map<string, any> }
) {
  const limit = options?.limit ?? 15;
  const analytics = options?.analyticsData || new Map();
  const products = [...productsList];

  const featured = [...products]
    .sort((a, b) => {
      const ap = a.prioritized ? 1 : 0;
      const bp = b.prioritized ? 1 : 0;
      if (ap !== bp) return bp - ap;

      const scoreA = analytics.get(a.id)?.engagement_score || 0;
      const scoreB = analytics.get(b.id)?.engagement_score || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;

      if ((b.popularity || 0) !== (a.popularity || 0)) return (b.popularity || 0) - (a.popularity || 0);
      if ((b.rating || 0) !== (a.rating || 0)) return (b.rating || 0) - (a.rating || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, limit);

  const newArrivals = [...products]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);

  // Trending Algorithm: Weighted sum calculation: sales (50%) + engagement (30%) + popularity (10%) + rating (10%)
  const trending = [...products]
    .map(prod => {
      const sales = salesCounts.get(prod.id) || 0;
      const engagement = analytics.get(prod.id)?.engagement_score || 0;
      const popularity = prod.popularity || 0;
      const rating = (prod.rating || 0) * 2;
      
      const totalScore = (sales * 10 * 0.5) + (engagement * 0.3) + (popularity * 0.1) + (rating * 0.1);
      return { product: prod, score: totalScore };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.product);

  const deals = [...products]
    .filter(prod => (typeof prod.offer_price === 'number' && prod.offer_price < prod.price) || (prod as any).discount_percentage > 0)
    .sort((a, b) => {
      const aDiscount = (a.price || 0) - (a.offer_price || a.price || 0);
      const bDiscount = (b.price || 0) - (b.offer_price || b.price || 0);
      if (bDiscount !== aDiscount) return bDiscount - aDiscount;
      return (b.popularity || 0) - (a.popularity || 0);
    })
    .slice(0, limit);

  return {
    featured,
    newArrivals,
    trending,
    deals,
  } as AutoFillResult;
}
