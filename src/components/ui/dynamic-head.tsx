'use client';

import * as React from 'react';

import { logger } from '../../lib/logger';

type SettingsPayload = {
  value?: unknown;
  [key: string]: unknown;
};

function extractSettingString(record: SettingsPayload | null, key: string): string | null {
  if (!record) return null;

  const direct = record[key];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const raw = record.value;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const nested = parsed[key];
      if (typeof nested === 'string' && nested.trim()) {
        return nested.trim();
      }
    } catch {
      return trimmed;
    }
  }

  if (raw && typeof raw === 'object') {
    const nested = (raw as Record<string, unknown>)[key];
    if (typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
  }

  return null;
}

export function DynamicFavicon() {
  React.useEffect(() => {
    let isMounted = true;

    const ensureFavicon = (href: string, type: string) => {
      if (!document.head) return;
      const id = 'dynamic-favicon';
      let link = document.head.querySelector(`link#${id}`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.type = type;
      link.href = href;
      logger.info('Favicon set', { href, context: 'DynamicFavicon.ensureFavicon' });
    };

    async function updateFavicon() {
      try {
        const fetchKey = async (key: string) => {
          const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
          if (!response.ok) {
            if (response.status !== 404) {
              logger.warn('Failed to fetch favicon setting', { key, status: response.status, context: 'DynamicFavicon.updateFavicon' });
            }
            return null;
          }

          const payload = (await response.json()) as SettingsPayload;
          return extractSettingString(payload, 'faviconUrl');
        };

        const primary = await fetchKey('faviconUrl');
        const fallback = primary || (await fetchKey('site_branding'));

        if (!isMounted) {
          return;
        }

        if (fallback) {
          const type = fallback.endsWith('.ico') ? 'image/x-icon' : 'image/png';
          ensureFavicon(fallback, type);
        } else {
          ensureFavicon('/brand.png', 'image/png');
        }
      } catch (error) {
        logger.error('Error updating favicon', { error, context: 'DynamicFavicon.updateFavicon' });
        if (isMounted) {
          ensureFavicon('/brand.png', 'image/png');
        }
      }
    }

    if (typeof window !== 'undefined') {
      updateFavicon();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}

export function DynamicTitle() {
  React.useEffect(() => {
    let isMounted = true;
    const suffix = 'CCTV, Computers & AMC Services in Goa';
    const defaultTitle = `TecBunny Solutions | ${suffix}`;

    async function updateTitle() {
      try {
        const fetchKey = async (key: string) => {
          const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, { cache: 'no-store' });
          if (!response.ok) {
            if (response.status !== 404) {
              logger.warn('Failed to fetch site name for title', { key, status: response.status, context: 'DynamicTitle.updateTitle' });
            }
            return null;
          }

          const payload = (await response.json()) as SettingsPayload;
          return extractSettingString(payload, 'siteName');
        };

        const primary = await fetchKey('siteName');
        const fallback = primary || (await fetchKey('site_branding'));

        if (fallback && isMounted && typeof window !== 'undefined') {
          const currentTitle = document.title.trim();
          if (currentTitle && currentTitle !== defaultTitle) {
            return;
          }

          const normalized = fallback.trim();
          const title = normalized.length < 12
            ? defaultTitle
            : normalized.toLowerCase().includes('cctv')
              ? normalized
              : `${normalized} | ${suffix}`;
          document.title = title;
          logger.info('Title updated', { title, context: 'DynamicTitle.updateTitle' });
        }
      } catch (error) {
        logger.error('Error updating title', { error, context: 'DynamicTitle.updateTitle' });
      }
    }

    if (typeof window !== 'undefined') {
      updateTitle();
    }

    return () => {
      isMounted = false;
    };
  }, []);

  return null;
}
