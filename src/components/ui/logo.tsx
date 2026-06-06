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

export function Logo({ className, width = 40, height = 40, alt = 'TecBunny Logo' }: LogoProps) {
  const [logoSrc, setLogoSrc] = React.useState<string>(BRAND_LOGO_URL);

  React.useEffect(() => {
    // Read from cache immediately on client mount to avoid layout shift
    const cachedLogo = localStorage.getItem('tecbunny_logo_url');
    if (cachedLogo) {
      setLogoSrc(normalizeLogoUrl(cachedLogo));
    }

    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/metadata');
        if (res.ok) {
          const data = await res.json();
          const normUrl = normalizeLogoUrl(data?.logoUrl);
          if (normUrl && normUrl !== cachedLogo) {
            setLogoSrc(normUrl);
            localStorage.setItem('tecbunny_logo_url', normUrl);
          }
        }
      } catch (err) {
        console.error('Failed to fetch dynamic brand logo:', err);
      }
    };

    fetchLogo();
  }, []);

  return (
    <img
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className ?? ''}`}
      loading="eager"
    />
  );
}

