import type { Metadata } from 'next';

import OffersManagement from '@/components/admin/OffersManagement';

export const metadata: Metadata = {
  title: 'Offers Management - Admin Panel | TecBunny Solutions',
  description: 'Create and manage promotional offers, discounts, and coupons for the TecBunny store.',
  keywords: 'offers management, discounts, coupons, promotions, admin panel',
  robots: 'noindex, nofollow' // Admin only content
};

export default function Page() {
  return <OffersManagement />;
}
