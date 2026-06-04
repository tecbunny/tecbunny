import type { Metadata } from 'next';

const siteUrl = 'https://www.tecbunny.com';
const defaultOgImage = 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png';
const xHandle = process.env.NEXT_PUBLIC_X_HANDLE;

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
  openGraph?: Metadata['openGraph'];
  twitter?: Metadata['twitter'];
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
  const resolvedImage = image.startsWith('http') ? image : `${siteUrl}${image}`;
  const canonical = path.startsWith('http') ? path : `${siteUrl}${path}`;

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'TecBunny Solutions',
      url: canonical,
      images: [
        {
          url: resolvedImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [resolvedImage],
      site: xHandle,
      creator: xHandle,
      ...twitter,
    },
  };
}
