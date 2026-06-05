import * as React from 'react';
import Image from 'next/image';

export const BRAND_LOGO_URL =
  'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
}

export function Logo({ className, width = 40, height = 40, alt = 'TecBunny Logo' }: LogoProps) {
  const [logoSrc, setLogoSrc] = React.useState<string>('/logo.png');

  React.useEffect(() => {
    // Read from cache immediately on client mount to avoid layout shift
    const cachedLogo = localStorage.getItem('tecbunny_logo_url');
    if (cachedLogo) {
      setLogoSrc(cachedLogo);
    }

    const fetchLogo = async () => {
      try {
        const res = await fetch('/api/metadata');
        if (res.ok) {
          const data = await res.json();
          if (data?.logoUrl && data.logoUrl !== (cachedLogo || '/logo.png')) {
            setLogoSrc(data.logoUrl);
            localStorage.setItem('tecbunny_logo_url', data.logoUrl);
          }
        }
      } catch (err) {
        console.error('Failed to fetch dynamic brand logo:', err);
      }
    };

    fetchLogo();
  }, []);

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className ?? ''}`}
      priority
    />
  );
}

