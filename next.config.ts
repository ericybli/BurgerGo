import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  // Serwist injectManifest source compiled to public/sw.js — implemented by the PWA group.
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Disable the SW in dev so the offline cache never masks fresh code while developing.
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail the standalone build on it.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['better-sqlite3'],
};

export default withSerwist(nextConfig);
