'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAnalytics } from './use-analytics';

/**
 * useBehavioralCRO
 * Tracks user interaction anomalies and triggers reactive UI states
 * (e.g. rapid scrolling on pricing or long dwell time in complex flows)
 */
export const useBehavioralCRO = () => {
  const pathname = usePathname();
  const { trackEvent } = useAnalytics();
  const [showAssistance, setShowAssistance] = useState(false);
  const scrollCount = useRef(0);
  const lastScrollPos = useRef(0);
  const lastScrollTime = useRef(Date.now());
  const dwellTimer = useRef<NodeJS.Timeout | null>(null);

  const handleScroll = useCallback(() => {
    const currentPos = window.scrollY;
    const now = Date.now();
    const timeDiff = now - lastScrollTime.current;
    
    // Detect rapid directional shifts (rapid scrolling back and forth)
    // within a 1000px range over short bursts
    if (Math.abs(currentPos - lastScrollPos.current) > 300 && timeDiff < 500) {
      scrollCount.current += 1;
    }

    if (scrollCount.current >= 3 && !showAssistance) {
      setShowAssistance(true);
      trackEvent('behavioral_anomaly_detected', { 
        type: 'rapid_scrolling', 
        path: pathname 
      });
    }

    lastScrollPos.current = currentPos;
    lastScrollTime.current = now;
  }, [pathname, showAssistance, trackEvent]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    // Detect extended dwell time in high-friction routes (/customised-setups)
    if (pathname.includes('/customised-setups')) {
      dwellTimer.current = setTimeout(() => {
        if (!showAssistance) {
          setShowAssistance(true);
          trackEvent('behavioral_anomaly_detected', { 
            type: 'extended_dwell', 
            path: pathname 
          });
        }
      }, 90000); // 90 seconds
    }

    return () => {
      if (dwellTimer.current) clearTimeout(dwellTimer.current);
      scrollCount.current = 0;
    };
  }, [pathname, showAssistance, trackEvent]);

  return {
    showAssistance,
    dismissAssistance: () => setShowAssistance(false),
    triggerContext: pathname.includes('/products') ? 'pricing' : 'architecture'
  };
};
