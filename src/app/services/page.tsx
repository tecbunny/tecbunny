import { Metadata } from 'next';

import ServicesPage from '../../components/services-page';
import { logger } from '../../lib/logger';
import { createClient, createServiceClient, isSupabaseServiceConfigured } from '../../lib/supabase/server';
import { createPageMetadata } from '../../lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'Services - TecBunny Store',
  description: 'Explore our comprehensive range of technology services including repairs, consultations, and custom solutions.',
  keywords: ['services', 'tech repair', 'consultation', 'TecBunny', 'technology solutions'],
  path: '/services',
  image: '/brand.png',
});

// Always fetch fresh data so admin updates appear immediately
// export const dynamic = 'force-dynamic';

export default async function Page() {
  let services: any[] = [];

  try {
    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : await createClient();

    const { data, error } = await supabase
      .from('services')
      .select('*');

    if (error) {
      logger.error('Error fetching services', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      services = [];
    } else {
      services = (data || [])
        .map((s: any) => {
          const statusVal = s.status;
          const isActive = typeof s.is_active === 'boolean'
            ? s.is_active
            : (typeof statusVal === 'boolean'
                ? statusVal
                : String(statusVal || '').toLowerCase() === 'active');
          const title = s.title || s.name || 'Service';
          const description = s.description || s.details || '';
          const rawFeatures = s.features || s.feature_list || [];
          const features = Array.isArray(rawFeatures)
            ? rawFeatures
            : (typeof rawFeatures === 'string'
                ? (() => { try { const parsed = JSON.parse(rawFeatures); return Array.isArray(parsed) ? parsed : []; } catch { return []; } })()
                : []);

          return {
            ...s,
            title,
            description,
            icon: s.icon || s.icon_name || null,
            features,
            badge: (s.badge as any) ?? null,
            is_active: isActive ?? true,
            category: s.category || 'Support',
            display_order: typeof s.display_order === 'number' ? s.display_order : 0,
          };
        })
        .filter((service: any) => service.is_active !== false);
    }
  } catch (error) {
    logger.error('Error in services page', { error });
    services = [];
  }

  services.sort((a: any, b: any) => {
    const ao = typeof a.display_order === 'number' ? a.display_order : null;
    const bo = typeof b.display_order === 'number' ? b.display_order : null;
    if (ao !== null && bo !== null) return ao - bo;
    if (ao !== null) return -1;
    if (bo !== null) return 1;
    return String(a.title).localeCompare(String(b.title));
  });

  return <ServicesPage services={services} />;
}
