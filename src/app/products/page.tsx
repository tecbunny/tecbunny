import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ShopPageContent } from '@/components/products/ShopPageContent';
import { createPageMetadata } from '@/lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Shop Products - TecBunny Store',
  description: 'Browse CCTV systems, computers, accessories, and AMC-ready hardware curated by TecBunny.',
  keywords: ['shop', 'products', 'CCTV', 'computers', 'accessories', 'TecBunny'],
  path: '/products',
  image: '/brand.png',
});

function ProductsPageSkeleton() {
  return (
    <div className="relative overflow-hidden bg-slate-950 text-slate-200 min-h-screen">
      <div className="pointer-events-none absolute inset-0 bg-[url('/noise.svg')] opacity-20" />
      <section className="py-6">
        <div className="container mx-auto px-4">
          <div className="h-48 w-full animate-pulse rounded-2xl bg-slate-800" />
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

export default function Page() {
  return (
    <Suspense fallback={<ProductsPageSkeleton />}>
      <ShopPageContent />
    </Suspense>
  );
}
