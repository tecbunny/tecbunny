import { Suspense } from 'react';
import { Metadata } from 'next';

import ContactPage from '@/components/contact-page';
import { createPageMetadata } from '@/lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'Contact TecBunny Solutions for CCTV, IT & Automation Quotes',
  description: 'Contact TecBunny Solutions for CCTV installation, IT support, AMC services, home automation, and RFID lock system quotes in Goa and Maharashtra.',
  keywords: ['contact TecBunny', 'CCTV quote Goa', 'IT support Goa', 'home automation contact Goa', 'AMC support Maharashtra'],
  path: '/contact',
  image: '/brand.png',
});

// Force static generation
// export const dynamic = 'force-static';

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <ContactPage />
    </Suspense>
  );
}
