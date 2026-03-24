/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_OUTPUT_MODE === 'export';

const nextConfig = {
  ...(isStaticExport ? { output: 'export' } : {}),
  eslint: {
    dirs: ['src'],
  },
  experimental: {
    optimizeCss: true,
  },
  poweredByHeader: false,
  images: {
    unoptimized: isStaticExport,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '**',
        port: '',
        pathname: '/**',
      }
    ],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  reactStrictMode: true,
}

export default nextConfig
