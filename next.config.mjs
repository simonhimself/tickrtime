/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Enable experimental features for better performance
  experimental: {
    // Enable TypeScript plugin for better DX
    typedRoutes: true,
  },

  // Server external packages (moved from experimental)
  serverExternalPackages: [],

  // Enable strict mode for better development experience
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Bundle analyzer for production builds
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      config.plugins.push(
        new (require('@next/bundle-analyzer')({ enabled: true }))()
      );
      return config;
    },
  }),

  // Environment variable validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
};

export default nextConfig;
