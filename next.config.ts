import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
import createNextIntlPlugin from 'next-intl/plugin';
import pkg from './package.json' with { type: 'json' };

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const withSerwist = withSerwistInit({
  // Serwist injectManifest source compiled to public/sw.js — implemented by the PWA group.
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Disable the SW in dev so the offline cache never masks fresh code while developing.
  disable: process.env.NODE_ENV === 'development',
});

// Configurable deploy sub-path (e.g. `/burgergo`). Empty/unset = root deploy.
// `undefined` (not '') is required so Next treats an unset value as "no basePath".
// basePath auto-prefixes pages, API route handlers, _next assets, <Link>,
// next/font, next/image and public/ files; assetPrefix mirrors it for static asset URLs.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  basePath,
  assetPrefix: basePath,
  // Inlined as a string literal at build time (read via src/lib/appVersion.ts).
  // No runtime I/O, so the static settings route stays static (`○`).
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  eslint: {
    // Lint is run explicitly via `npm run lint`; don't fail the standalone build on it.
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ['better-sqlite3', 'undici'],
};

export default withSerwist(withNextIntl(nextConfig));
