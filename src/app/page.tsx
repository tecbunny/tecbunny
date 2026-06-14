import { Suspense } from 'react';

import type { Metadata } from 'next';

import HomePage from '@/components/home-page';
import { createPageMetadata } from '@/lib/metadata';

// Force dynamic rendering for homepage as requested
// export const dynamic = 'force-dynamic';

// Homepage metadata for SEO
export const metadata: Metadata = createPageMetadata({
  title: 'TecBunny | Tech Services, CCTV & AMC Solutions',
  description:
    'TecBunny Solutions engineered premium IT services, CCTV installation, AMC support, home automation, and custom hardware setups in Goa and Maharashtra.',
  keywords: [
    'tech services',
    'custom setup',
    'technology support',
    'hardware solutions',
    'technical services',
    'IT support',
    'TecBunny',
  ],
  path: '/',
  image: '/brand.png',
});

function HomePageSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
        <div className="container mx-auto px-4">
          <div className="animate-pulse">
            <div className="h-12 bg-gray-200 rounded w-3/4 mx-auto mb-6"></div>
            <div className="h-6 bg-gray-200 rounded w-1/2 mx-auto mb-8"></div>
            <div className="h-12 bg-gray-200 rounded w-48 mx-auto"></div>
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePage />
    </Suspense>
  );
}
