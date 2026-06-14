import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ShopPageContent } from '@/components/products/ShopPageContent';
import { logger } from '@/lib/logger';
import { createPageMetadata } from '@/lib/metadata';
import { filterPubliclyVisibleProducts } from '@/lib/product-visibility';

// ISR: revalidate every 5 minutes (300 seconds)
export const revalidate = 300;

export const metadata: Metadata = createPageMetadata({
  title: 'Buy CCTV, IT Hardware & Security Systems | TecBunny',
  description: 'Shop premium CCTV systems, surveillance cameras, computer hardware, and accessories curated by TecBunny. Best pricing in Goa.',
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
    <div className="relative min-h-screen bg-black text-zinc-100 font-sans">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f11_1px,transparent_1px),linear-gradient(to_bottom,#0f0f11_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[350px] w-[600px] -translate-x-1/2 bg-zinc-500/5 blur-[120px]" />
      <section className="py-24 sm:py-32">
        <div className="relative mx-auto max-w-7xl px-6 sm:px-8">
          <div className="flex flex-col items-center text-center gap-6">
            <div className="flex flex-col items-center gap-4">
              <div className="h-6 w-28 bg-zinc-900 border border-zinc-800 rounded-full animate-pulse" />
              <div className="h-14 w-80 bg-zinc-900/60 rounded-xl animate-pulse" />
              <div className="h-4 w-72 bg-zinc-900/60 rounded-lg animate-pulse animate-pulse" />
            </div>
            <div className="w-full max-w-lg h-11 bg-zinc-900/40 border border-zinc-800 rounded-xl animate-pulse" />
          </div>
          <div className="mt-16 grid gap-6 grid-cols-[repeat(auto-fit,minmax(250px,1fr))]">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex h-full flex-col rounded-2xl border border-zinc-900 bg-zinc-950/40 p-6 animate-pulse">
                <div className="aspect-square w-full rounded-xl bg-zinc-900/60 mb-6" />
                <div className="space-y-2">
                  <div className="h-3 w-1/4 bg-zinc-900/60 rounded" />
                  <div className="h-5 w-3/4 bg-zinc-900/60 rounded" />
                  <div className="h-4 w-5/6 bg-zinc-900/60 rounded" />
                </div>
                <div className="mt-8 flex items-center justify-between pt-4 border-t border-zinc-900">
                  <div className="h-6 w-20 bg-zinc-900/60 rounded" />
                  <div className="h-9 w-9 bg-zinc-900/60 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
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
