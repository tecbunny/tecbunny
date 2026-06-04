import { Metadata } from 'next';

import HeroCarouselManager from '@/components/admin/HeroCarouselManager';

export const metadata: Metadata = {
  title: 'Hero Banners | Admin Management',
  description: 'Manage hero banner carousels for homepage, services, offers, and products.',
};

export default function Page() {
  return <HeroCarouselManager />;
}
