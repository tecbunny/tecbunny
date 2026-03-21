import type {Metadata, Viewport} from 'next';
import Script from 'next/script';
import { Inter, Poppins } from 'next/font/google';
import { Suspense } from 'react';
import { Analytics } from '@vercel/analytics/react';

import './globals.css';
import {Header} from '../components/layout/Header';
import {Footer} from '../components/layout/Footer';
import {TechShell} from '../components/layout/TechShell';
import { FloatingAIAssistant } from '../components/layout/FloatingAIAssistant';
import {AppProvider} from '../context/AppProvider';
import {OrderProvider} from '../context/OrderProvider';
import {Toaster} from '../components/ui/toaster';
import {ThemeProvider} from '../components/providers/ThemeProvider';
import {DynamicFavicon, DynamicTitle} from '../components/ui/dynamic-head';
import {AuthStateManager} from '../components/auth/AuthStateManager';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.tecbunny.com'),
  title: {
    default: 'TecBunny Solutions | CCTV, Computers & AMC Services in Goa',
    template: '%s | TecBunny Solutions',
  },
  description:
    'TecBunny Solutions provides CCTV installation, computer hardware, AMC services, and custom tech setups across Goa. Trusted installation, maintenance, and support.',
  applicationName: 'TecBunny Solutions',
  keywords: [
    'CCTV Goa',
    'computer hardware Goa',
    'AMC services',
    'security systems',
    'tech services',
    'networking',
    'biometric systems',
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
    title: 'TecBunny Solutions | CCTV, Computers & AMC Services in Goa',
    description:
      'CCTV installation, computer hardware, AMC services, and custom tech setups across Goa. Trusted installation, maintenance, and support.',
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
    title: 'TecBunny Solutions | CCTV, Computers & AMC Services in Goa',
    description:
      'CCTV installation, computer hardware, AMC services, and custom tech setups across Goa. Trusted installation, maintenance, and support.',
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
      name: 'TecBunny Solutions',
      url: 'https://www.tecbunny.com',
      logo: 'https://www.tecbunny.com/brand.png',
      description:
        'TecBunny Solutions offers CCTV, computer hardware, AMC services, and custom tech setups across Goa.',
    },
    {
      '@type': ['LocalBusiness', 'ITService', 'SecurityService'],
      name: 'TecBunny Solutions',
      url: 'https://www.tecbunny.com',
      image: 'https://www.tecbunny.com/brand.png',
      description:
        'CCTV installation, computer hardware, AMC services, networking, and custom tech setups in Goa.',
      areaServed: 'Goa, India',
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
                  strategy="beforeInteractive"
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
                strategy="afterInteractive"
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
gtag('config', '${gaId}', { anonymize_ip: true });`}
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
