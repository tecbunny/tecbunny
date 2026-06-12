'use client';

import * as React from 'react';
import Link from 'next/link';

type AnalyticsConsent = 'accepted' | 'rejected' | 'unknown';

const CONSENT_STORAGE_KEY = 'tecbunny_analytics_consent';

function readStoredConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') {
    return 'unknown';
  }

  const storedValue = window.localStorage.getItem(CONSENT_STORAGE_KEY);
  if (storedValue === 'accepted' || storedValue === 'rejected') {
    return storedValue;
  }

  return 'unknown';
}

type CookieConsentBannerProps = {
  onConsentChange?: (consent: Exclude<AnalyticsConsent, 'unknown'>) => void;
};

export function CookieConsentBanner({ onConsentChange }: CookieConsentBannerProps) {
  const [consent, setConsent] = React.useState<AnalyticsConsent>('unknown');
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    const storedConsent = readStoredConsent();
    setConsent(storedConsent);
    setHydrated(true);
  }, []);

  const updateConsent = React.useCallback(
    (nextConsent: Exclude<AnalyticsConsent, 'unknown'>) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CONSENT_STORAGE_KEY, nextConsent);
      }

      setConsent(nextConsent);
      onConsentChange?.(nextConsent);
    },
    [onConsentChange]
  );

  React.useEffect(() => {
    if (!hydrated || consent === 'unknown') {
      return;
    }

    onConsentChange?.(consent);
  }, [consent, hydrated, onConsentChange]);

  if (!hydrated || consent !== 'unknown') {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] border-t border-border bg-card/95 px-4 py-4 text-card-foreground shadow-2xl backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">Privacy Controls</p>
          <p className="text-sm leading-6 text-muted-foreground sm:text-[15px]">
            TecBunny uses optional analytics and marketing cookies to understand site performance and measure campaign activity. Rejecting keeps the site fully usable and skips third-party tracking scripts.
          </p>
          <p className="text-xs text-muted-foreground">
            Review the details in{' '}
            <Link href="/info/policies/privacy" className="text-primary underline decoration-primary/60 underline-offset-4 transition hover:text-foreground">
              our privacy policy
            </Link>
            .
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => updateConsent('rejected')}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/40"
          >
            Reject optional cookies
          </button>
          <button
            type="button"
            onClick={() => updateConsent('accepted')}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Accept optional cookies
          </button>
        </div>
      </div>
    </div>
  );
}

export { CONSENT_STORAGE_KEY };