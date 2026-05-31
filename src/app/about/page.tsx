import { Metadata } from 'next';

import AboutPage from '@/components/about-page';
import { createPageMetadata } from '@/lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'About TecBunny Solutions in Goa',
  description: 'Learn about TecBunny Solutions, a Goa-based technology partner for CCTV, IT services, AMC support, smart automation, and secure infrastructure.',
  keywords: ['about TecBunny', 'Goa IT company', 'CCTV company Goa', 'home automation Goa', 'technology partner Goa'],
  path: '/about',
  image: '/brand.png',
});

// Optimized for static generation
export default function Page() {
  return <AboutPage />;
}
