import { Metadata } from 'next';

import ServicesPage from '@/components/services-page';
import { logger } from '@/lib/logger';
import { createServiceClient, isSupabaseServiceConfigured } from '@/lib/supabase/server';
import { createSupabaseClient as createPublicSupabaseClient } from '@/lib/supabase-server';
import { createPageMetadata } from '@/lib/metadata';
import { BRAND_LOGO_URL } from '@/components/ui/logo';
import { stripHtmlToPlainText } from '@/lib/strings';
import type { Service } from '@/lib/types';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'Professional Technology Services | TecBunny Solutions',
  description: 'TecBunny Solutions offers professional technology services and custom solutions tailored to your needs.',
  keywords: ['technology services', 'IT support', 'custom solutions', 'professional services', 'technical support', 'TecBunny'],
  path: '/services',
  image: BRAND_LOGO_URL,
});

export const revalidate = 300;

type ServiceRow = {
  id: string | number;
  icon?: string | null;
  icon_name?: string | null;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  details?: string | null;
  features?: unknown;
  feature_list?: unknown;
  badge?: Service['badge'] | string | null;
  is_active?: boolean | null;
  status?: string | boolean | null;
  price?: number | string | null;
  duration_days?: number | null;
  category?: Service['category'] | string | null;
  display_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  terms_and_conditions?: string | null;
};

function parseFeatures(rawFeatures: unknown): string[] {
  if (Array.isArray(rawFeatures)) {
    return rawFeatures.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  if (typeof rawFeatures === 'string') {
    try {
      const parsed = JSON.parse(rawFeatures);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }

  return [];
}

function isServiceRow(value: unknown): value is ServiceRow {
  return !!value && typeof value === 'object' && 'id' in value;
}

function normalizeService(row: ServiceRow): Service {
  const statusValue = row.status;
  const isActive = typeof row.is_active === 'boolean'
    ? row.is_active
    : (typeof statusValue === 'boolean'
        ? statusValue
        : String(statusValue || '').toLowerCase() === 'active');
  const title = stripHtmlToPlainText(row.title || row.name, 90) || 'Service';
  const description = stripHtmlToPlainText(row.description || row.details, 220);

  return {
    id: String(row.id),
    title,
    description,
    icon: row.icon || row.icon_name || 'Wrench',
    features: parseFeatures(row.features ?? row.feature_list ?? [])
      .map((feature) => stripHtmlToPlainText(feature, 120))
      .filter((feature) => feature.length > 0),
    badge: row.badge === 'Popular' || row.badge === 'Recommended' || row.badge === 'New' || row.badge === 'Featured'
      ? row.badge
      : null,
    is_active: isActive ?? true,
    price: typeof row.price === 'number' ? row.price : Number(row.price ?? 0) || undefined,
    duration_days: typeof row.duration_days === 'number' ? row.duration_days : undefined,
    category: (row.category || 'Support') as Service['category'],
    display_order: typeof row.display_order === 'number' ? row.display_order : 0,
    created_at: row.created_at || new Date(0).toISOString(),
    updated_at: row.updated_at || new Date(0).toISOString(),
    terms_and_conditions: row.terms_and_conditions || undefined,
  };
}

export default async function Page() {
  let services: Service[] = [];
  let hasServiceLoadError = false;

  try {
    const supabase = isSupabaseServiceConfigured
      ? createServiceClient()
      : createPublicSupabaseClient();

    // Select the row shape Supabase exposes and normalize defensively below.
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
      hasServiceLoadError = true;
    } else {
      const serviceRows = (Array.isArray(data) ? (data as unknown[]) : []).filter(isServiceRow);
      services = serviceRows
        .map(normalizeService)
        .filter((service) => service.is_active !== false);
    }
  } catch (error) {
    logger.error('Error in services page', { error });
    services = [];
    hasServiceLoadError = true;
  }

  services.sort((a, b) => {
    const ao = typeof a.display_order === 'number' ? a.display_order : null;
    const bo = typeof b.display_order === 'number' ? b.display_order : null;
    if (ao !== null && bo !== null) return ao - bo;
    if (ao !== null) return -1;
    if (bo !== null) return 1;
    return String(a.title).localeCompare(String(b.title));
  });

  return <ServicesPage services={services} hasServiceLoadError={hasServiceLoadError} />;
}
