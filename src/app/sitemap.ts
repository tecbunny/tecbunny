import type { MetadataRoute } from 'next';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { filterPubliclyVisibleProducts } from '@/lib/product-visibility';
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
        .select('*')
        .eq('status', 'active')
        .eq('is_deleted', false);

      if (products) {
        productRoutes = filterPubliclyVisibleProducts(products).map((product) => ({
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

  const staticRoutes = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/customised-setups`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/services`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
  ];

  return [
    ...staticRoutes,
    ...productRoutes,
  ];
}
