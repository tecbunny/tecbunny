import type { Metadata } from 'next';

const siteUrl = 'https://www.tecbunny.com';
const defaultOgImage = `${siteUrl}/brand.png`;
const xHandle = process.env.NEXT_PUBLIC_X_HANDLE;

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  image?: string;
  keywords?: string[];
}

export function createPageMetadata({
  title,
  description,
  path,
  image = defaultOgImage,
  keywords = [],
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
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [resolvedImage],
      site: xHandle,
      creator: xHandle,
    },
  };
}
