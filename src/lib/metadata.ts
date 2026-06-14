import type { Metadata } from 'next';
import { stripHtmlToPlainText } from './strings';

const siteUrl = 'https://www.tecbunny.com';
const defaultOgImage = 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png';
const xHandle = process.env.NEXT_PUBLIC_X_HANDLE;
const defaultDescription = 'TecBunny Solutions provides technology services, custom setups, and technical support.';

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  openGraph?: Metadata['openGraph'];
  twitter?: Metadata['twitter'];
}

export function cleanMetadataTitle(value: string | null | undefined, fallback = 'TecBunny | CCTV, IT Services & Home Automation in Goa'): string {
  let title = stripHtmlToPlainText(value).trim();
  if (!title || title.toLowerCase() === 'null' || title.toLowerCase() === 'undefined') {
    title = fallback;
  }
  if (title.length < 50) {
    const suffix = ' | TecBunny Solutions';
    if (title.length + suffix.length <= 60) {
      title = title + suffix;
    } else {
      const shortSuffix = ' | TecBunny';
      if (title.length + shortSuffix.length <= 60) {
        title = title + shortSuffix;
      }
    }
  }
  if (title.length < 50) {
    const padding = ' - Premium IT & Security Services';
    title = (title + padding).slice(0, 60);
  }
  if (title.length > 60) {
    title = title.slice(0, 60);
  }
  return title;
}

export function cleanMetadataDescription(
  value: string | null | undefined,
  fallback = 'TecBunny Solutions provides premium CCTV installation, IT services, AMC support, and home automation in Goa and Maharashtra. Secure your space now.',
): string {
  let description = stripHtmlToPlainText(value).trim();
  if (!description || description.toLowerCase() === 'null' || description.toLowerCase() === 'undefined') {
    description = fallback;
  }
  if (description.length < 140) {
    const padding = ' We deliver elite technology setups, structured network cabling, and robust commercial hardware maintenance services for businesses.';
    description = (description + padding).slice(0, 155);
  }
  if (description.length > 155) {
    description = description.slice(0, 155);
  }
  return description;
}

export function createPageMetadata({
  title,
  description,
  path,
  image = defaultOgImage,
  keywords = [],
  openGraph,
  twitter,
}: PageMetaInput): Metadata {
  const activeImage = (image === '/brand.png' || image.endsWith('/brand.png')) ? defaultOgImage : image;
  const resolvedImage = activeImage.startsWith('http') ? activeImage : `${siteUrl}${activeImage}`;
  const rawCanonical = path.startsWith('http') ? path : `${siteUrl}${path}`;
  const urlObj = new URL(rawCanonical);
  let canonicalPath = urlObj.pathname.toLowerCase().replace(/\/+/g, '/');
  if (canonicalPath.endsWith('/') && canonicalPath !== '/') {
    canonicalPath = canonicalPath.slice(0, -1);
  }
  const canonical = `${siteUrl}${canonicalPath}`;

  const safeTitle = cleanMetadataTitle(title);
  const safeDescription = cleanMetadataDescription(description);

  return {
    title: safeTitle,
    description: safeDescription,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      ...openGraph,
      title: safeTitle,
      description: safeDescription,
      type: 'website',
      siteName: 'TecBunny Solutions',
      url: canonical,
      images: [
        {
          url: resolvedImage,
          width: 1200,
          height: 630,
          alt: safeTitle,
        },
      ],
    },
    twitter: {
      ...twitter,
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDescription,
      images: [resolvedImage],
      site: xHandle,
      creator: xHandle,
    },
  };
}
