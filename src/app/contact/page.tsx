import { Suspense } from 'react';
import { Metadata } from 'next';

import ContactPage from '@/components/contact-page';
import { createPageMetadata } from '@/lib/metadata';

// Static metadata for better SEO and performance
export const metadata: Metadata = createPageMetadata({
  title: 'Contact TecBunny Solutions',
  description: 'Get in touch with TecBunny Solutions for technology services, custom solutions, and technical support.',
  keywords: ['contact TecBunny', 'technology support', 'technical services', 'customer support'],
  path: '/contact',
  image: '/brand.png',
});

// Force static generation
// export const dynamic = 'force-static';

const contactFaqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Do you offer site visits?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, TecBunny provides site consultation visits in North Goa. Standard repairs may include a visit charge, and major installations can have that charge waived.',
      },
    },
    {
      '@type': 'Question',
      name: 'How fast is installation?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Standard home CCTV setups with up to 8 cameras are typically completed within 24 to 48 hours after confirmation.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does AMC cover?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'AMC plans include maintenance, software updates, lens cleaning, and priority breakdown support. Hardware replacement costs are separate unless covered by warranty or the selected plan.',
      },
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactFaqJsonLd).replace(/</g, '\\u003c') }}
      />
      <Suspense fallback={<div className="min-h-screen bg-background" />}>
        <ContactPage />
      </Suspense>
    </>
  );
}
