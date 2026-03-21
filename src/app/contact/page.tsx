import { Suspense } from 'react';
import { Metadata } from 'next';

import ContactPage from '../../components/contact-page';
import { createPageMetadata } from '../../lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'Contact Us - TecBunny Store',
  description: "Get in touch with TecBunny Store. We're here to help with your technology needs and questions.",
  keywords: ['contact', 'support', 'help', 'TecBunny', 'customer service'],
  path: '/contact',
  image: '/brand.png',
});

// Force static generation
// export const dynamic = 'force-static';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ContactPage />
    </Suspense>
  );
}
