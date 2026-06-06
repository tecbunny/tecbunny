import * as React from 'react';

export const BRAND_LOGO_URL = '/logo.png';

export function normalizeLogoUrl(url: string | null | undefined): string {
  if (!url) return BRAND_LOGO_URL;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'logo.png' || trimmed === '/logo.png') return BRAND_LOGO_URL;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  return '/' + trimmed;
}

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

function canLoadImage(src: string): Promise<boolean> {
  if (src === BRAND_LOGO_URL) return Promise.resolve(true);

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = src;
  });
}

export function Logo({ className, width = 40, height = 40, alt = 'TecBunny Logo' }: LogoProps) {
  const [logoSrc, setLogoSrc] = React.useState<string>(BRAND_LOGO_URL);

  React.useEffect(() => {
    let isMounted = true;

    const applyLogo = async (rawUrl: string | null | undefined) => {
      const normalizedUrl = normalizeLogoUrl(rawUrl);
      const isValid = await canLoadImage(normalizedUrl);

      if (!isMounted) return;

      if (isValid) {
        setLogoSrc(normalizedUrl);
        localStorage.setItem('tecbunny_logo_url', normalizedUrl);
      } else {
        setLogoSrc(BRAND_LOGO_URL);
        localStorage.removeItem('tecbunny_logo_url');
      }
    };

    // Read from cache immediately on client mount to avoid layout shift
    const cachedLogo = localStorage.getItem('tecbunny_logo_url');
    if (cachedLogo) {
      void applyLogo(cachedLogo);
    }

    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/metadata');
        if (res.ok) {
          const data = await res.json();
          await applyLogo(data?.logoUrl);
        }
      } catch (err) {
        console.error('Failed to fetch dynamic brand logo:', err);
      }
    };

    fetchLogo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className ?? ''}`}
      loading="eager"
      onError={() => {
        if (logoSrc !== BRAND_LOGO_URL) {
          setLogoSrc(BRAND_LOGO_URL);
          localStorage.removeItem('tecbunny_logo_url');
        }
      }}
    />
  );
}

