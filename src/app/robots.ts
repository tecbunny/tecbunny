import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://www.tecbunny.com';

  return {
    rules: [
      {
        userAgent: ['Googlebot', 'Bingbot'],
        allow: '/',
        disallow: [
          '/api/',
          '/mgmt/',
          '/auth/',
          '/checkout/',
          '/cart/',
          '/profile/',
          '/admin/',
          '/superadmin/',
          '/staff/',
          '/dashboard/',
        ],
      },
      {
        userAgent: ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-Web', 'CCBot', 'Google-Extended', 'Anthropic-AI', 'Omgilibot', 'FacebookBot'],
        disallow: '/',
      },
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/mgmt/',
          '/auth/',
          '/checkout/',
          '/cart/',
          '/profile/',
          '/admin/',
          '/superadmin/',
          '/staff/',
          '/dashboard/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
