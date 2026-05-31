import type { MetadataRoute } from 'next';
import { createClient } from '../lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.tecbunny.com';
  const now = new Date();
  const supabase = await createClient();

  const { data: products } = await supabase.from('products').select('id, updated_at').eq('active', true);

  const productRoutes = products?.map((product) => ({
    url: `${baseUrl}/products/${product.id}`,
    lastModified: product.updated_at ? new Date(product.updated_at) : now,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  })) || [];

  return [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...productRoutes,
  ];
}
