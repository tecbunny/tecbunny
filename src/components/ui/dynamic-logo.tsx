'use client';

import * as React from 'react';

import { logger } from '@/lib/logger';

import { Logo as StaticLogo } from './logo';

interface DynamicLogoProps {
  className?: string;
  width?: number;
  height?: number;
  fallbackToStatic?: boolean;
  alt?: string;
}

type SettingsPayload = {
  value?: unknown;
  logoUrl?: string;
};

function extractLogoUrl(record: SettingsPayload | null): string | null {
  if (!record) return null;

  if (typeof record.logoUrl === 'string' && record.logoUrl.trim()) {
    return record.logoUrl.trim();
  }

  const raw = record.value;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    try {
      const parsed = JSON.parse(trimmed) as { logoUrl?: unknown };
      if (parsed && typeof parsed.logoUrl === 'string' && parsed.logoUrl.trim()) {
        return parsed.logoUrl.trim();
      }
    } catch {
      return trimmed;
    }
  }

  if (raw && typeof raw === 'object') {
    const maybe = (raw as Record<string, unknown>).logoUrl;
    if (typeof maybe === 'string' && maybe.trim()) {
      return maybe.trim();
    }
  }

  return null;
}

async function fetchLogoSetting(key: string, signal?: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(`/api/settings?key=${encodeURIComponent(key)}`, { cache: 'no-store', signal });
    if (!response.ok) {
      if (response.status !== 404) {
        logger.warn('Failed to fetch logo setting', { key, status: response.status, context: 'DynamicLogo.fetchLogoSetting' });
      }
      return null;
    }

    const payload = (await response.json()) as SettingsPayload;
    return extractLogoUrl(payload);
  } catch (error) {
    logger.error('Logo setting request failed', { error, key, context: 'DynamicLogo.fetchLogoSetting' });
    return null;
  }
}

export function DynamicLogo({
  className,
  width = 40,
  height = 40,
  fallbackToStatic = true,
  alt = 'Site logo',
}: DynamicLogoProps) {
  const [logoUrl, setLogoUrl] = React.useState<string>('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function resolveLogo() {
      try {
        let resolved = await fetchLogoSetting('logoUrl', controller.signal);
        if (!resolved) {
          resolved = await fetchLogoSetting('site_branding', controller.signal);
        }

        if (isMounted) {
          if (resolved) {
            setLogoUrl(resolved);
            setError(false);
          } else {
            logger.info('Falling back to static logo', { context: 'DynamicLogo.resolveLogo' });
            setError(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(true);
        }
        logger.error('Error resolving logo', { error: err, context: 'DynamicLogo.resolveLogo' });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    resolveLogo();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Show loading state
  if (loading) {
    return (
      <div 
        className={`bg-muted animate-pulse rounded ${className}`}
        style={{ width, height }}
      />
    );
  }

  // Show custom logo if available
  if (logoUrl && !error) {
    return (
      <img
        src={logoUrl}
        alt={alt}
        className={`object-contain ${className || ''}`}
        width={width}
        height={height}
        onError={() => setError(true)}
        style={{ maxWidth: width, maxHeight: height }}
      />
    );
  }

  // Fallback to static logo or nothing
  if (fallbackToStatic) {
    return (
      <StaticLogo 
        className={className || ''}
        width={width}
        height={height}
        alt={alt}
      />
    );
  }

  return null;
}
