import type { MetadataRoute } from 'next';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { filterPubliclyVisibleProducts } from '@/lib/product-visibility';
import { isSupabasePublicConfigured, requireSupabasePublicEnv } from '@/lib/supabase/env';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://www.tecbunny.com';
  const now = new Date();
  let productRoutes: Array<{ url: string; lastModified: Date; changeFrequency: 'weekly'; priority: number }> = [];
  let blueprintRoutes: Array<{ url: string; lastModified: Date; changeFrequency: 'weekly'; priority: number }> = [];

  if (isSupabasePublicConfigured) {
    try {
      const { url, publicKey } = requireSupabasePublicEnv();
      const supabase = createSupabaseClient(url, publicKey, {
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

      const { data: blueprints } = await supabase
        .from('published_blueprints')
        .select('id, updated_at');

      if (blueprints) {
        blueprintRoutes = blueprints.map((blueprint) => ({
          url: `${baseUrl}/blueprints/${blueprint.id}`,
          lastModified: blueprint.updated_at ? new Date(blueprint.updated_at) : now,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }));
      }
    } catch (error) {
      console.warn('Failed to fetch sitemap database routes', error);
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
    {
      url: `${baseUrl}/services/smart-infrastructure`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/webdev`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/offers`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/products`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ai-research`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/info/faqs`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    },
    {
      url: `${baseUrl}/info/policies`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/info/policies/privacy`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/info/policies/refund-cancellation`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/info/policies/return`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/info/policies/shipping`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
    {
      url: `${baseUrl}/info/policies/terms`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    },
  ];

  return [
    ...staticRoutes,
    ...productRoutes,
    ...blueprintRoutes,
  ];
}
