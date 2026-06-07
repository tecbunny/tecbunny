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
  serverExternalPackages: [],
  poweredByHeader: false,
  images: {
    unoptimized: isStaticExport,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
    remotePatterns: allowedImageHosts.map((hostname) => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname: '/**',
    })),
  },
  reactStrictMode: true,
}

export default nextConfig
