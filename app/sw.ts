import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time with the real, build-hashed precache list.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/**
 * Runtime caching policy (spec §7.3). Pure + exported so it is unit-testable without a SW global.
 * Order matters: `google` (NetworkOnly) is first so /api/google/* never falls through to SWR.
 */
export function buildRuntimeCaching(): RuntimeCaching[] {
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

declare const self: ServiceWorkerGlobalScope;

// Only bootstrap the Serwist runtime when actually running as a service worker.
// Guarding here lets `buildRuntimeCaching` be imported and unit-tested in jsdom.
if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [...buildRuntimeCaching(), ...defaultCache],
  });

  serwist.addEventListeners();
}
