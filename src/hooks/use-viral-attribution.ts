'use client';

import { useCallback } from 'react';
import { logger } from '@/lib/logger';

const VIRAL_ATTRIBUTION_KEY = 'tecbunny_viral_parent';
const ATTRIBUTION_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 Days

/**
 * User Attribution Persistence Matrix Hook
 */
export function useViralAttribution() {
  const trackLanding = useCallback((blueprintId: string) => {
    try {
      const existing = localStorage.getItem(VIRAL_ATTRIBUTION_KEY);
      
      if (!existing) {
        const payload = {
          parentBlueprintId: blueprintId,
          timestamp: Date.now(),
          converted: false
        };
        localStorage.setItem(VIRAL_ATTRIBUTION_KEY, JSON.stringify(payload));
        logger.info('viral_attribution_marker_dropped', { blueprintId });
      }
    } catch (err) {
      console.error('Failed to drop viral attribution marker', err);
    }
  }, []);

  const getParentAttribution = useCallback(() => {
    try {
      const raw = localStorage.getItem(VIRAL_ATTRIBUTION_KEY);
      if (!raw) return null;

      const data = JSON.parse(raw);
      const isExpired = Date.now() - data.timestamp > ATTRIBUTION_EXPIRY;

      if (isExpired) {
        localStorage.removeItem(VIRAL_ATTRIBUTION_KEY);
        return null;
      }

      return data;
    } catch (err) {
      return null;
    }
  }, []);

  const markConversion = useCallback(async (orderId: string) => {
    const attribution = getParentAttribution();
    if (attribution && !attribution.converted) {
      try {
        // Background query to trigger milestone notification for creator
        await fetch('/api/blueprints/attribution/conversion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentBlueprintId: attribution.parentBlueprintId,
            newOrderId: orderId
          })
        });

        // Mark as converted locally to avoid double counting
        attribution.converted = true;
        localStorage.setItem(VIRAL_ATTRIBUTION_KEY, JSON.stringify(attribution));
        logger.info('viral_conversion_recorded', { parentId: attribution.parentBlueprintId, orderId });
      } catch (err) {
        logger.error('failed_to_trigger_viral_milestone', { err });
      }
    }
  }, [getParentAttribution]);

  return { trackLanding, getParentAttribution, markConversion };
}
