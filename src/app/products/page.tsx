import { Suspense } from 'react';

import type { Metadata } from 'next';

import { ShopPageContent } from '../../components/products/ShopPageContent';
import { createPageMetadata } from '../../lib/metadata';

export const metadata: Metadata = createPageMetadata({
  title: 'Shop Products - TecBunny Store',
  description: 'Browse CCTV systems, computers, accessories, and AMC-ready hardware curated by TecBunny.',
  keywords: ['shop', 'products', 'CCTV', 'computers', 'accessories', 'TecBunny'],
  path: '/products',
  image: '/brand.png',
});

function ProductsPageSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
        <div className="flex gap-4 mb-8">
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-200 h-48 rounded-lg mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
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
