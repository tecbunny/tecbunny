import type {Metadata, Viewport} from 'next';
import dynamic from 'next/dynamic';
import Script from 'next/script';
import { Inter, Poppins } from 'next/font/google';
import { Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';

import './globals.css';
import {Header} from '../components/layout/Header';
import {Footer} from '../components/layout/Footer';
import {TechShell} from '../components/layout/TechShell';
import {AppProvider} from '../context/AppProvider';
import {OrderProvider} from '../context/OrderProvider';
import {Toaster} from '../components/ui/toaster';
import {ThemeProvider} from '../components/providers/ThemeProvider';
import {DynamicFavicon, DynamicTitle} from '../components/ui/dynamic-head';
import {AuthStateManager} from '../components/auth/AuthStateManager';

const FloatingAIAssistant = dynamic(
  () => import('../components/layout/FloatingAIAssistant').then((module) => module.FloatingAIAssistant),
  { ssr: false }
);

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION;

export const metadata: Metadata = {
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
      sameAs: [
        'https://www.facebook.com/profile.php?id=61578165368064',
        'https://www.instagram.com/tecbunny_solutions/',
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

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  variable: '--font-headline',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID || 'G-VCCMTMSVP4';
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className={`${inter.variable} ${poppins.variable} font-body antialiased`}>
        <ThemeProvider>
          <AppProvider>
            <OrderProvider>
              <AuthStateManager />
              <DynamicFavicon />
              <DynamicTitle />
                <Script id="iubenda-config" strategy="beforeInteractive">
                  {`var _iub = _iub || [];
_iub.csConfiguration = {"siteId":4401650,"cookiePolicyId":81350062,"lang":"en","storage":{"useSiteId":true}};`}
                </Script>
                <Script
                  src="https://cs.iubenda.com/autoblocking/4401650.js"
                  strategy="beforeInteractive"
                />
                <Script
                  src="https://cdn.iubenda.com/cs/gpp/stub.js"
                  strategy="afterInteractive"
                />
                <Script
                  src="https://cdn.iubenda.com/cs/iubenda_cs.js"
                  strategy="afterInteractive"
                  charSet="UTF-8"
                />
              <TechShell>
                <div className="flex min-h-screen flex-col bg-background text-foreground">
                  <Suspense fallback={<div className="h-16 border-b" />}>
                    <Header />
                  </Suspense>
                  <main className="flex-1">{children}</main>
                  <Footer />
                </div>
              </TechShell>
              <FloatingAIAssistant />
              <Toaster />
              <Analytics />
              {/* Cloudflare Web Analytics */}
              <Script
                src="https://static.cloudflareinsights.com/beacon.min.js"
                data-cf-beacon='{"token": "47dd7f9fc88a419790b0682afbad1861"}'
                strategy="lazyOnload"
              />
              {/* End Cloudflare Web Analytics */}
              {gaId ? (
                <>
                  <Script
                    src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
                    type="text/plain"
                    data-cookieconsent="analytics"
                    data-iub-purposes="4"
                    strategy="lazyOnload"
                  />
                  <Script
                    id="ga-init"
                    strategy="lazyOnload"
                    type="text/plain"
                    data-cookieconsent="analytics"
                    data-iub-purposes="4"
                  >
                    {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true, send_page_view: false });`}
                  </Script>
                </>
              ) : null}
            </OrderProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
