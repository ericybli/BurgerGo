import { defaultCache } from '@serwist/next/worker';
import type { RouteMatchCallback, SerwistGlobalConfig } from 'serwist';
import type { PrecacheEntry } from 'serwist';
import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkOnly, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time with the real, build-hashed precache list.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/**
 * Describes a runtime caching entry in a plain, serialisable form so the routing
 * policy is unit-testable without a real ServiceWorker environment.
 */
export interface CacheEntry {
  name: string;
  handler: string;
  matcher: RouteMatchCallback;
  options: { cacheName: string; expiration?: { maxEntries?: number; maxAgeSeconds?: number } };
}

/**
 * Runtime caching policy (spec §7.3). Pure + exported so it is unit-testable without a SW global.
 * Order matters: `google` (NetworkOnly) is first so /api/google/* never falls through to SWR.
 */
export function buildRuntimeCaching(): CacheEntry[] {
  return [
    {
      name: 'google',
      handler: 'NetworkOnly',
      matcher({ url }) {
        return (
          url.pathname.startsWith('/api/google') ||
          /(^|\.)googleapis\.com$/.test(url.hostname) ||
          /(^|\.)gstatic\.com$/.test(url.hostname) ||
          url.hostname === 'maps.google.com'
        );
      },
      options: { cacheName: 'burgergo-google' },
    },
    {
      name: 'photos',
      handler: 'CacheFirst',
      matcher({ url }) {
        return (
          url.pathname === '/burgergo-logo.png' ||
          url.pathname.startsWith('/icons/') ||
          /^\/api\/photos\/[^/]+\/[^/]+$/.test(url.pathname)
        );
      },
      options: {
        cacheName: 'burgergo-photos',
        expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      name: 'data',
      handler: 'StaleWhileRevalidate',
      matcher({ url }) {
        return url.pathname.startsWith('/api/trips') || url.pathname === '/api/settings';
      },
      options: {
        cacheName: 'burgergo-data',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ];
}

// Service worker bootstrap — only runs in the real SW environment.
// The `self.__SW_MANIFEST` reference below is required by @serwist/next's
// injectManifest transform; it stamps the build-hashed precache list here at build time.
// In test/jsdom the global `skipWaiting` function is absent so we skip instantiation.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _g = globalThis as any;
if (typeof _g.skipWaiting === 'function') {
  const runtimeCaching = buildRuntimeCaching().map((entry) => {
    const plugins = entry.options.expiration
      ? [new ExpirationPlugin({ maxEntries: entry.options.expiration.maxEntries, maxAgeSeconds: entry.options.expiration.maxAgeSeconds })]
      : [];

    let handler;
    switch (entry.handler) {
      case 'CacheFirst':
        handler = new CacheFirst({ cacheName: entry.options.cacheName, plugins });
        break;
      case 'StaleWhileRevalidate':
        handler = new StaleWhileRevalidate({ cacheName: entry.options.cacheName, plugins });
        break;
      case 'NetworkOnly':
      default:
        handler = new NetworkOnly();
        break;
    }

    return { matcher: entry.matcher, handler };
  });

  const serwist = new Serwist({
    // self.__SW_MANIFEST is stamped in by @serwist/next's injectManifest transform at build time.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    precacheEntries: (self as any).__SW_MANIFEST as (PrecacheEntry | string)[] | undefined,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [...runtimeCaching, ...defaultCache],
  });

  serwist.addEventListeners();
}
