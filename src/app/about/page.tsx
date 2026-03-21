import { Metadata } from 'next';

import AboutPage from '../../components/about-page';
import { createPageMetadata } from '../../lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'About Us - TecBunny Store',
  description: 'Learn about TecBunny Store, our mission, values, and the team behind your favorite technology destination.',
  keywords: ['about', 'team', 'mission', 'values', 'TecBunny', 'company'],
  path: '/about',
  image: '/brand.png',
});

// Optimized for static generation
export default function Page() {
  return <AboutPage />;
}
