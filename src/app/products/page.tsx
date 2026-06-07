import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ShopPageContent } from '@/components/products/ShopPageContent';
import { logger } from '@/lib/logger';
import { createPageMetadata } from '@/lib/metadata';
import { filterPubliclyVisibleProducts } from '@/lib/product-visibility';

// ISR: revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

export const metadata: Metadata = createPageMetadata({
  title: 'Shop Products - TecBunny Store',
  description: 'Browse CCTV systems, computers, accessories, and AMC-ready hardware curated by TecBunny.',
  keywords: ['shop', 'products', 'CCTV', 'computers', 'accessories', 'TecBunny'],
  path: '/products',
  image: '/brand.png',
});

function getSiteOrigin() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` ||
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}` ||
    'https://www.tecbunny.com'
  ).replace(/\/$/, '');
}

async function fetchJsonArray(pathname: string, dataKey = 'data') {
  try {
    const response = await fetch(`${getSiteOrigin()}${pathname}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      logger.warn('products.page.initial_fetch_failed', {
        pathname,
        status: response.status,
      });
      return [];
    }

    const payload = await response.json();
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.[dataKey])) return payload[dataKey];
    return [];
  } catch (error) {
    logger.error('products.page.initial_fetch_error', { pathname, error });
    return [];
  }
}

function ProductsPageSkeleton() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200 min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-noise opacity-20" />
      <section className="py-10 sm:py-14">
        <div className="container mx-auto px-4">
          <div className="h-[340px] sm:h-[420px] w-full animate-pulse rounded-3xl bg-slate-900/60 border border-white/5" />
        </div>
      </section>
      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-0 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="h-6 w-24 bg-cyan-500/20 rounded-full mb-4 animate-pulse" />
              <div className="h-12 w-64 bg-slate-800 rounded-lg animate-pulse" />
            </div>
            <div className="w-full max-w-md h-12 bg-slate-800 rounded-xl animate-pulse" />
          </div>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="space-y-3 rounded-2xl border border-white/5 bg-white/5 p-4 animate-pulse">
              <div className="h-48 w-full rounded-xl bg-slate-800" />
              <div className="h-4 w-3/4 bg-slate-800" />
              <div className="h-4 w-1/2 bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function Page() {
  const [products, offers] = await Promise.all([
    fetchJsonArray('/api/products?status=active&limit=200'),
    fetchJsonArray('/api/auto-offers?active=true'),
  ]);

  const rawProducts = filterPubliclyVisibleProducts(products);
  const rawOffers = offers;

  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ShopPageContent initialRawProducts={rawProducts} initialRawAutoOffers={rawOffers} />
    </Suspense>
  );
}
