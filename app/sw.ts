import { defaultCache } from '@serwist/next/worker';
import type { RouteMatchCallback, RouteMatchCallbackOptions, SerwistGlobalConfig } from 'serwist';
import type { PrecacheEntry } from 'serwist';
import { Serwist, CacheFirst, StaleWhileRevalidate, NetworkFirst, NetworkOnly, ExpirationPlugin } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time with the real, build-hashed precache list.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

/** Minimal matcher options for unit-testable routing (omits the ServiceWorker-only `event`). */
export type TestableMatcherOptions = Pick<RouteMatchCallbackOptions, 'url' | 'request' | 'sameOrigin'>;

/**
 * Describes a runtime caching entry in a plain, serialisable form so the routing
 * policy is unit-testable without a real ServiceWorker environment.
 * Using `TestableMatcherOptions` (no `event`) keeps tests free of SW globals.
 */
export interface CacheEntry {
  name: string;
  handler: string;
  matcher: (opts: TestableMatcherOptions) => boolean;
  options: { cacheName?: string; expiration?: { maxEntries?: number; maxAgeSeconds?: number } };
}

/**
 * Derive the deploy sub-path from the SW's own URL. The SW is served at
 * `<basePath>/sw.js`, so stripping the trailing `/sw.js` yields the basePath
 * (`/burgergo`, or `''` at root). NEXT_PUBLIC_BASE_PATH is not inlined into the
 * @serwist/next-compiled worker, so we resolve it at runtime instead. Falsy
 * `self.location` (jsdom/test) falls back to `''`.
 */
export function swBasePath(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loc = (globalThis as any).self?.location?.href as string | undefined;
  if (!loc) return '';
  return new URL(loc).pathname.replace(/\/sw\.js$/, '');
}

/**
 * Runtime caching policy (spec §7.3). Pure + exported so it is unit-testable without a SW global.
 * Order matters: `google` (NetworkOnly) is first so /api/google/* never falls through to SWR.
 *
 * `base` is the deploy sub-path (e.g. `/burgergo`, or `''` at root). All same-origin
 * path matchers are prefixed with it so the policy works under any basePath; defaults
 * to the runtime-derived value (`swBasePath()`) but is injectable for tests.
 */
export function buildRuntimeCaching(base: string = swBasePath()): CacheEntry[] {
  return [
    {
      name: 'google',
      handler: 'NetworkOnly',
      matcher({ url }: TestableMatcherOptions) {
        return (
          url.pathname.startsWith(`${base}/api/google`) ||
          /(^|\.)googleapis\.com$/.test(url.hostname) ||
          /(^|\.)gstatic\.com$/.test(url.hostname) ||
          url.hostname === 'maps.google.com'
        );
      },
      options: {},
    },
    {
      name: 'photos',
      handler: 'CacheFirst',
      matcher({ url }: TestableMatcherOptions) {
        return (
          url.pathname === `${base}/burgergo-logo.png` ||
          url.pathname.startsWith(`${base}/icons/`) ||
          // 1B cached-Google photos: /api/photos/<placeId>/<variant>
          new RegExp(`^${base}/api/photos/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-2 personal photos: /api/photos/p/<photoId>/<size>
          new RegExp(`^${base}/api/photos/p/[^/]+/[^/]+$`).test(url.pathname) ||
          // Plan-3 link thumbnails: /api/links/thumb/<linkId>
          new RegExp(`^${base}/api/links/thumb/[^/]+$`).test(url.pathname)
        );
      },
      options: {
        cacheName: 'burgergo-photos',
        expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // NetworkFirst (not SWR): when online, always return FRESH data so
      // add/edit/delete reflect immediately (SWR served the stale cache first,
      // making mutations appear to need a manual refresh). Offline falls back to
      // the cached JSON, preserving the offline-read promise.
      name: 'data',
      handler: 'NetworkFirst',
      matcher({ url }: TestableMatcherOptions) {
        return url.pathname.startsWith(`${base}/api/trips`) || url.pathname === `${base}/api/settings`;
      },
      options: {
        cacheName: 'burgergo-data',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Page documents (the static app shells) + Next's RSC navigation/prefetch
      // payloads. NetworkFirst so an online visit caches the shell; offline
      // navigations to any previously-visited route (/, /trip/:id, /trip/:id/plan,
      // /settings) fall back to the cache. Ordered AFTER `data` so /api/* requests
      // (incl. RSC fetches to API routes) are never swallowed here. (spec §7.3/§8.2)
      name: 'pages',
      handler: 'NetworkFirst',
      matcher({ url, request, sameOrigin }: TestableMatcherOptions) {
        if (!sameOrigin) return false;
        if (url.pathname.startsWith(`${base}/api/`)) return false;
        return request.mode === 'navigate' || request.headers.get('RSC') === '1';
      },
      options: {
        cacheName: 'burgergo-pages',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
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
      case 'NetworkFirst':
        handler = new NetworkFirst({ cacheName: entry.options.cacheName, plugins });
        break;
      case 'NetworkOnly':
      default:
        handler = new NetworkOnly();
        break;
    }

    // Cast to RouteMatchCallback since in the real SW, ExtendableEvent is always present.
    return { matcher: entry.matcher as RouteMatchCallback, handler };
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
