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
  return (
    <Image
      src="/logo.png"
      alt={alt}
      width={width}
      height={height}
      className={`object-contain ${className ?? ''}`}
      priority
    />
  );
}

