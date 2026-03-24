'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Script from 'next/script';

import { useDeferredActivation } from '../../hooks/use-deferred-activation';
import { CookieConsentBanner, CONSENT_STORAGE_KEY } from './CookieConsentBanner';

const Toaster = dynamic(
  () => import('../ui/toaster').then((module) => module.Toaster),
  { ssr: false }
);

type AnalyticsConsent = 'accepted' | 'rejected' | 'unknown';

function scheduleWhenIdle(callback: () => void, timeout = 2400) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(() => callback(), { timeout });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = window.setTimeout(callback, timeout);
  return () => window.clearTimeout(timeoutId);
}

type DeferredRuntimeServicesProps = {
  gaId?: string;
  metaPixelId?: string;
};

export function DeferredRuntimeServices({ gaId, metaPixelId }: DeferredRuntimeServicesProps) {
  const isActivated = useDeferredActivation({ timeout: 8000 });
  const [shouldRender, setShouldRender] = React.useState(false);
  const [analyticsConsent, setAnalyticsConsent] = React.useState<AnalyticsConsent>('unknown');

  React.useEffect(() => {
    if (!isActivated) {
      return undefined;
    }

    return scheduleWhenIdle(() => setShouldRender(true));
  }, [isActivated]);

  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedConsent = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (storedConsent === 'accepted' || storedConsent === 'rejected') {
      setAnalyticsConsent(storedConsent);
    }
  }, []);

  if (!shouldRender) {
    return <CookieConsentBanner onConsentChange={setAnalyticsConsent} />;
  }

  return (
    <>
      <CookieConsentBanner onConsentChange={setAnalyticsConsent} />
      <Toaster />
      {gaId && analyticsConsent === 'accepted' ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="lazyOnload"
          />
          <Script
            id="ga-init"
            strategy="lazyOnload"
          >
            {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
gtag('js', new Date());
gtag('config', '${gaId}', { anonymize_ip: true, send_page_view: false });`}
          </Script>
        </>
      ) : null}
      {metaPixelId && analyticsConsent === 'accepted' ? (
        <>
          <Script id="meta-pixel-init" strategy="lazyOnload">
            {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
fbq('track', 'PageView');`}
          </Script>
          <noscript>
            <img
              alt=""
              height="1"
              width="1"
              style={{ display: 'none' }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      ) : null}
    </>
  );
}