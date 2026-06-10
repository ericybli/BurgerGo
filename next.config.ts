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
  experimental: {
    // AI-import sends downscaled screenshots through a Server Action; the 1 MB
    // default is too small for several images. Client downscales to ~1024px.
    serverActions: { bodySizeLimit: '12mb' },
  },
  serverExternalPackages: ['better-sqlite3', 'undici'],
  // CORS for the whole API so browser-based native clients (e.g. Expo web on
  // localhost) can call it cross-origin. The API is intentionally open (an
  // optional x-api-key guards writes via BURGERGO_API_KEY), so `*` does not
  // change its security posture. `source` is basePath-relative — Next prefixes
  // it automatically, and these headers also apply to the auto-generated
  // OPTIONS preflight responses for route handlers.
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'content-type,x-api-key' },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
