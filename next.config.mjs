/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_MODE === 'export';

const hostFromUrl = (value) => {
  try {
    return value ? new URL(value).hostname : null;
  } catch {
    return null;
  }
};

const allowedImageHosts = Array.from(new Set([
  'tecbunny.com',
  'www.tecbunny.com',
  'placehold.co',
  hostFromUrl(process.env.NEXT_PUBLIC_SITE_URL),
  hostFromUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  ...(process.env.NEXT_IMAGE_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean),
].filter(Boolean)));

const nextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  experimental: {
    optimizeCss: true,
  },
  serverExternalPackages: ['pdfkit'],
  poweredByHeader: false,
  images: {
    unoptimized: isStaticExport,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
      ...allowedImageHosts.map((hostname) => ({
        protocol: 'https',
        hostname,
        port: '',
        pathname: '/**',
      }))
    ],
  },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self'; object-src 'none'; base-uri 'self';",
          },
        ],
      },
    ];
  },
}

export default nextConfig
