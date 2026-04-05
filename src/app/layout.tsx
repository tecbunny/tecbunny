import type {Metadata, Viewport} from 'next';
import { Inter } from 'next/font/google';
import { Suspense } from 'react';

import './globals.css';
import {Header} from '../components/layout/Header';
import {Footer} from '../components/layout/Footer';
import {TechShell} from '../components/layout/TechShell';
import {AppProvider} from '../context/AppProvider';
import {OrderProvider} from '../context/OrderProvider';
import {ThemeProvider} from '../components/providers/ThemeProvider';
import {DeferredFloatingAIAssistant} from '../components/layout/DeferredFloatingAIAssistant';
import {DeferredRuntimeServices} from '../components/layout/DeferredRuntimeServices';

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
    template: '%s | TecBunny Solutions',
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
        url: '/brand.png',
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
    images: ['/brand.png'],
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
        url: '/brand.png',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        url: '/brand.png',
        sizes: '16x16',
        type: 'image/png',
      },
    ],
    shortcut: '/brand.png',
    apple: [
      {
        url: '/brand.png',
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
      '@type': 'Organization',
      '@id': 'https://www.tecbunny.com/#organization',
      name: 'TecBunny Solutions',
      url: 'https://www.tecbunny.com',
      logo: 'https://www.tecbunny.com/brand.png',
      description:
        'TecBunny Solutions offers CCTV, IT services, AMC support, home automation, RFID lock systems, and custom tech setups across Goa and Maharashtra.',
      sameAs: sameAsLinks,
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
      name: 'TecBunny Solutions',
      url: 'https://www.tecbunny.com',
      image: 'https://www.tecbunny.com/brand.png',
      description:
        'CCTV installation, IT services, AMC support, networking, home automation, and RFID lock systems in Goa and Maharashtra.',
      telephone: '+91-9604136010',
      email: 'support@tecbunny.com',
      priceRange: 'INR',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'H No 11 Nhayginwada, Parse, Parxem',
        addressLocality: 'Pernem',
        addressRegion: 'Goa',
        postalCode: '403512',
        addressCountry: 'IN',
      },
      areaServed: [
        {
          '@type': 'State',
          name: 'Goa',
        },
        {
          '@type': 'State',
          name: 'Maharashtra',
        },
      ],
      serviceType: [
        'CCTV installation',
        'IT services',
        'AMC support',
        'Home automation',
        'RFID lock systems',
        'Computer networking',
      ],
    },
  ],
};

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
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
              <DeferredRuntimeServices gaId={gaId} metaPixelId={metaPixelId} />
            </OrderProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
