'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export const useAnalytics = () => {
  const pathname = usePathname();
  const sessionId = useRef<string>('');

  const sendToGtag = useCallback((eventType: string, data?: Record<string, unknown>) => {
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
      return;
    }

    window.gtag('event', eventType, {
      page_location: typeof window !== 'undefined' ? window.location.href : undefined,
      page_path: pathname,
      page_title: typeof document !== 'undefined' ? document.title : undefined,
      ...data,
    });
  }, [pathname]);

  useEffect(() => {
    // Initialize session ID
    let storedSession = sessionStorage.getItem('analytics_session_id');
    if (!storedSession) {
      storedSession = uuidv4();
      sessionStorage.setItem('analytics_session_id', storedSession);
    }
    sessionId.current = storedSession;
  }, []);

  const trackEvent = useCallback(async (eventType: string, data?: Record<string, unknown>) => {
    sendToGtag(eventType, data);

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType,
          pageUrl: window.location.href,
          sessionId: sessionId.current,
          ...data,
        })
      });
    } catch (error) {
      console.error('Failed to track event', error);
    }
  }, [sendToGtag]);

  // Auto-track page views
  useEffect(() => {
    void trackEvent('page_view');
  }, [trackEvent]);

  return { trackEvent };
};
