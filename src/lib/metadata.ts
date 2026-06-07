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

export function cleanMetadataTitle(value: string | null | undefined, fallback = 'TecBunny Solutions'): string {
  const title = stripHtmlToPlainText(value, 70);
  if (!title || title.toLowerCase() === 'null' || title.toLowerCase() === 'undefined') {
    return fallback;
  }
  return title;
}

export function cleanMetadataDescription(
  value: string | null | undefined,
  fallback = defaultDescription,
): string {
  const description = stripHtmlToPlainText(value, 160);
  if (!description || description.toLowerCase() === 'null' || description.toLowerCase() === 'undefined') {
    return fallback;
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
  const canonical = path.startsWith('http') ? path : `${siteUrl}${path}`;
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
