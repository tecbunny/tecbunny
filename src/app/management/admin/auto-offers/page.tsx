import type { Metadata } from 'next';

import AutoOffersManagement from '@/components/admin/AutoOffersManagement';

export const metadata: Metadata = {
   title: 'Auto-Offers Management - Admin Panel | Techbunny Solutions',
   description: 'Create and manage automatic offers that apply to customer carts based on eligibility criteria.',
   keywords: 'auto offers, discount management, promotional offers, cart offers, admin panel',
   robots: 'noindex, nofollow' // Admin only content
 };

export default function Page() {
  return <AutoOffersManagement />;
}
