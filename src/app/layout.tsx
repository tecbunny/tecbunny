import type {Metadata, Viewport} from 'next';

const BRAND_LOGO_URL = 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';

import './globals.css';
import {Header} from '@/components/layout/Header';
import {Footer} from '@/components/layout/Footer';
import {TechShell} from '@/components/layout/TechShell';
import {AppProvider} from '../context/AppProvider';
import {OrderProvider} from '../context/OrderProvider';
import {ThemeProvider} from '@/components/providers/ThemeProvider';
import {DeferredFloatingAIAssistant} from '@/components/layout/DeferredFloatingAIAssistant';
import {DeferredRuntimeServices} from '@/components/layout/DeferredRuntimeServices';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BlitzAuditBanner } from '@/components/ui/BlitzAuditBanner';

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;
const xHandle = process.env.NEXT_PUBLIC_X_HANDLE;
const xUrl = process.env.NEXT_PUBLIC_X_URL;

const sameAsLinks = [
  'https://www.facebook.com/profile.php?id=61578165368064',
  'https://www.instagram.com/tecbunny_solutions/',
  xUrl,
].filter((value): value is string => Boolean(value));

export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
  metadataBase: new URL('https://www.tecbunny.com'),
  title: {
    default: 'TecBunny Solutions | CCTV, IT Services, Home Automation & AMC in Goa & Maharashtra',
    template: '%s | TecBunny',
  },
  description:
    'TecBunny Solutions provides CCTV installation, IT services, AMC support, home automation, RFID lock systems, and custom tech setups across Goa and Maharashtra.',
  applicationName: 'TecBunny Solutions',
  keywords: [
    'CCTV installation Goa',
    'IT services Goa',
    'AMC services Goa',
    'home automation Goa',
    'RFID lock system Goa',
    'computer networking Goa',
    'CCTV Maharashtra',
    'smart security systems',
    'TecBunny',
  ],
  authors: [{ name: 'TecBunny Solutions' }],
  publisher: 'TecBunny Solutions',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    url: 'https://www.tecbunny.com',
    title: 'TecBunny Solutions | CCTV, IT Services, Home Automation & AMC in Goa & Maharashtra',
    description:
      'CCTV installation, IT services, AMC support, home automation, RFID lock systems, and custom tech setups across Goa and Maharashtra.',
    siteName: 'TecBunny Solutions',
    images: [
      {
        url: BRAND_LOGO_URL,
        width: 512,
        height: 512,
        alt: 'TecBunny Solutions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TecBunny Solutions | CCTV, IT Services, Home Automation & AMC in Goa & Maharashtra',
    description:
      'CCTV installation, IT services, AMC support, home automation, RFID lock systems, and custom tech setups across Goa and Maharashtra.',
    images: [BRAND_LOGO_URL],
    site: xHandle,
    creator: xHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
  icons: {
    icon: [
      {
        url: '/logo.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/logo.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    shortcut: '/logo.png',
    apple: [
      {
        url: '/logo.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://www.tecbunny.com/#website',
      url: 'https://www.tecbunny.com',
      name: 'TecBunny Solutions',
      description:
        'TecBunny Solutions provides CCTV installation, IT services, AMC support, networking, home automation, and RFID lock systems in Goa and Maharashtra.',
      publisher: { '@id': 'https://www.tecbunny.com/#organization' },
      author: { '@id': 'https://www.tecbunny.com/#organization' },
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.tecbunny.com/#organization',
      name: 'TecBunny Solutions',
      url: 'https://www.tecbunny.com',
      logo: BRAND_LOGO_URL,
      description:
        'TecBunny Solutions offers CCTV, IT services, AMC support, home automation, RFID lock systems, and custom tech setups across Goa and Maharashtra.',
      sameAs: sameAsLinks,
      founder: [
        {
          '@type': 'Person',
          '@id': 'https://www.tecbunny.com/#shubham',
          name: 'Shubham Sakharam Bhisaji',
          jobTitle: 'Director & Co-Founder',
        },
        {
          '@type': 'Person',
          '@id': 'https://www.tecbunny.com/#kamana',
          name: 'Kamana Ashok Bandekar',
          jobTitle: 'Director & Co-Founder',
        },
      ],
      contactPoint: [
        {
          '@type': 'ContactPoint',
          telephone: '+91-9604136010',
          contactType: 'customer support',
          areaServed: ['IN-GA', 'IN-MH'],
          email: 'support@tecbunny.com',
        },
      ],
    },
    {
      '@type': ['LocalBusiness', 'ITService', 'SecurityService'],
      '@id': 'https://www.tecbunny.com/#localbusiness',
      name: 'TecBunny Solutions Private Limited',
      legalName: 'TECBUNNY SOLUTIONS PRIVATE LIMITED',
      foundingDate: '2025',
      url: 'https://www.tecbunny.com',
      logo: BRAND_LOGO_URL,
      image: BRAND_LOGO_URL,
      description:
        'CCTV installation, IT services, AMC support, networking, home automation, and RFID lock systems in Goa and Maharashtra.',
      telephone: '+91-9604136010',
      email: 'support@tecbunny.com',
      priceRange: '\u20b9\u20b9',
      currenciesAccepted: 'INR',
      paymentAccepted: 'Cash, UPI, Bank Transfer, Credit Card',
      taxID: '30AAMCT1608G1ZO',
      iso6523Code: '0199:U80200GA2025PTC017488',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'H No 11, Nhayginwada, Parse, Parxem',
        addressLocality: 'Pernem',
        addressRegion: 'Goa',
        postalCode: '403512',
        addressCountry: 'IN',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 15.6730616,
        longitude: 73.7855133,
      },
      openingHoursSpecification: [{
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        opens: '09:00',
        closes: '19:00',
      }],
      areaServed: [
        { '@type': 'City', name: 'Pernem', sameAs: 'https://www.wikidata.org/wiki/Q1011550' },
        { '@type': 'City', name: 'Mapusa', sameAs: 'https://www.wikidata.org/wiki/Q1015694' },
        { '@type': 'City', name: 'Panaji', sameAs: 'https://www.wikidata.org/wiki/Q1352' },
        { '@type': 'City', name: 'Margao', sameAs: 'https://www.wikidata.org/wiki/Q1006277' },
        { '@type': 'City', name: 'Vasco da Gama', sameAs: 'https://www.wikidata.org/wiki/Q1006271' },
        { '@type': 'City', name: 'Mumbai', sameAs: 'https://www.wikidata.org/wiki/Q1156' },
        { '@type': 'City', name: 'Pune', sameAs: 'https://www.wikidata.org/wiki/Q1538' },
        { '@type': 'State', name: 'Goa', sameAs: 'https://www.wikidata.org/wiki/Q1177' },
        { '@type': 'State', name: 'Maharashtra', sameAs: 'https://www.wikidata.org/wiki/Q1191' },
      ],
      knowsAbout: [
        {
          '@type': 'Thing',
          name: 'Closed-circuit television',
          sameAs: [
            'https://en.wikipedia.org/wiki/Closed-circuit_television',
            'https://www.wikidata.org/wiki/Q240126',
          ],
        },
        {
          '@type': 'Thing',
          name: 'Information technology consulting',
          sameAs: [
            'https://en.wikipedia.org/wiki/Information_technology_consulting',
            'https://www.wikidata.org/wiki/Q1994646',
          ],
        },
        {
          '@type': 'Thing',
          name: 'Home automation',
          sameAs: [
            'https://en.wikipedia.org/wiki/Home_automation',
            'https://www.wikidata.org/wiki/Q848375',
          ],
        },
        {
          '@type': 'Thing',
          name: 'Security alarm',
          sameAs: [
            'https://en.wikipedia.org/wiki/Security_alarm',
            'https://www.wikidata.org/wiki/Q1413809',
          ],
        },
      ],
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Services',
        itemListElement: [
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'CCTV Installation & AMC' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Computer Repair & Upgrade' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Home Automation' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'RFID & Access Control' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Networking & Structured Cabling' } },
          { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Web Development' } },
        ],
      },
      sameAs: sameAsLinks,
    },
  ],
};

const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || 'G-VCCMTMSVP4';
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fbcsagupcxheyiusjfak.supabase.co" />
        <link rel="dns-prefetch" href="https://fbcsagupcxheyiusjfak.supabase.co" />
        <link rel="dns-prefetch" href="https://www.facebook.com" />
        <link rel="dns-prefetch" href="https://www.instagram.com" />
        <link rel="dns-prefetch" href="https://maps.googleapis.com" />
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
          />
      </head>
      <body className={`${inter.variable} font-body antialiased`}>
        <ThemeProvider>
          <AppProvider>
            <OrderProvider>
              <TechShell>
                <div className="flex min-h-screen flex-col bg-background text-foreground">
                  <Suspense fallback={<div className="h-16 border-b" />}>
                    <Header />
                  </Suspense>
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </TechShell>
              <DeferredFloatingAIAssistant />
              <BlitzAuditBanner />
              <DeferredRuntimeServices gaId={gaId} metaPixelId={metaPixelId} />
              <SpeedInsights />
            </OrderProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
