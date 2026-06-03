import type { MetadataRoute } from 'next';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { isSupabasePublicConfigured, requireSupabasePublicEnv } from '@/lib/supabase/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.tecbunny.com';
  const now = new Date();
  let productRoutes: Array<{ url: string; lastModified: Date; changeFrequency: 'weekly'; priority: number }> = [];

  if (isSupabasePublicConfigured) {
    try {
      const { url, anonKey } = requireSupabasePublicEnv();
      const supabase = createSupabaseClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        }
      });
      const { data: products } = await supabase
        .from('products')
        .select('id, updated_at')
        .eq('active', true);

      if (products) {
        productRoutes = products.map((product) => ({
          url: `${baseUrl}/products/${product.id}`,
          lastModified: product.updated_at ? new Date(product.updated_at) : now,
          changeFrequency: 'weekly' as const,
          priority: 0.8,
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch sitemap products', error);
    }
  }

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
