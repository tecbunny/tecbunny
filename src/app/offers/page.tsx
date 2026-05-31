import { Metadata } from 'next';

import OffersPage from '@/components/offers-page';

// Static metadata for better SEO and performance
export const metadata: Metadata = {
  title: 'Special Offers & Deals - TecBunny Store',
  description: 'Discover amazing deals and special offers on the latest technology products at TecBunny Store.',
  keywords: ['offers', 'deals', 'discounts', 'TecBunny', 'special prices', 'technology deals'],
  openGraph: {
    title: 'Special Offers & Deals - TecBunny Store',
    description: 'Discover amazing deals and special offers on the latest technology products at TecBunny Store.',
    type: 'website',
  },
};

// Force static generation
// export const dynamic = 'force-static';

export default function Page() {
  return <OffersPage />;
}
