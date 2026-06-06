import { describe, it, expect } from 'vitest';
import { buildRuntimeCaching, swBasePath } from './sw';

function matcher(name: string, base = '') {
  const entry = buildRuntimeCaching(base).find((e) => e.name === name);
  if (!entry) throw new Error(`no runtimeCaching entry named ${name}`);
  return entry;
}

function matches(
  name: string,
  url: string,
  init?: { mode?: RequestMode; headers?: Record<string, string>; sameOrigin?: boolean; base?: string },
): boolean {
  const entry = matcher(name, init?.base ?? '');
  // The matchers only read `request.mode` and `request.headers`. jsdom's Request
  // ignores `mode`, so we hand-build a minimal request-shaped object instead.
  const request = {
    mode: init?.mode ?? 'cors',
    headers: new Headers(init?.headers),
  } as unknown as Request;
  const sameOrigin = init?.sameOrigin ?? (new URL(url).origin === 'https://app.example.com');
  return Boolean(
    entry.matcher({
      url: new URL(url),
      request,
      sameOrigin,
    }),
  );
}

describe('buildRuntimeCaching', () => {
  it('SWR-caches trip-data + settings JSON under burgergo-data', () => {
    const entry = matcher('data');
    expect(entry.handler).toBe('StaleWhileRevalidate');
    expect(entry.options.cacheName).toBe('burgergo-data');
    expect(matches('data', 'https://app.example.com/api/trips')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/trips/abc-123')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/settings')).toBe(true);
    expect(matches('data', 'https://app.example.com/api/health')).toBe(false);
  });

  it('CacheFirst-caches logo, icons, and uploaded photos under burgergo-photos', () => {
    const entry = matcher('photos');
    expect(entry.handler).toBe('CacheFirst');
    expect(entry.options.cacheName).toBe('burgergo-photos');
    expect(matches('photos', 'https://app.example.com/burgergo-logo.png')).toBe(true);
    expect(matches('photos', 'https://app.example.com/icons/icon-192.png')).toBe(true);
    expect(matches('photos', 'https://app.example.com/api/photos/p1/card')).toBe(true);
    expect(matches('photos', 'https://app.example.com/api/trips')).toBe(false);
  });

  it('CacheFirst matches the personal-photo serving path /api/photos/p/<id>/<size>', () => {
    const entry = buildRuntimeCaching('').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/api/photos/p/photo-1/card');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(true);
  });

  it('CacheFirst matches the personal-photo path under a basePath', () => {
    const entry = buildRuntimeCaching('/burgergo').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/burgergo/api/photos/p/photo-1/thumb');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(true);
  });

  it('does NOT CacheFirst the single-segment upload endpoint /api/photos', () => {
    const entry = buildRuntimeCaching('').find((e) => e.name === 'photos')!;
    const url = new URL('http://x/api/photos');
    expect(entry.matcher({ url, request: new Request(url), sameOrigin: true })).toBe(false);
  });

  it('NetworkOnly for the Google proxy and Google/Maps origins', () => {
    const entry = matcher('google');
    expect(entry.handler).toBe('NetworkOnly');
    expect(matches('google', 'https://app.example.com/api/google/details')).toBe(true);
    expect(matches('google', 'https://maps.googleapis.com/maps/api/js')).toBe(true);
    expect(matches('google', 'https://maps.gstatic.com/tile.png')).toBe(true);
    expect(matches('google', 'https://app.example.com/api/trips')).toBe(false);
  });

  it('orders google (NetworkOnly) before data so /api/google/* is never SWR-cached', () => {
    const names = buildRuntimeCaching().map((e) => e.name);
    expect(names.indexOf('google')).toBeLessThan(names.indexOf('data'));
  });

  it('NetworkFirst-caches same-origin navigations + RSC payloads under burgergo-pages', () => {
    const entry = matcher('pages');
    expect(entry.handler).toBe('NetworkFirst');
    expect(entry.options.cacheName).toBe('burgergo-pages');

    // A real page navigation (request.mode === 'navigate').
    expect(matches('pages', 'https://app.example.com/', { mode: 'navigate' })).toBe(true);
    expect(matches('pages', 'https://app.example.com/trip/abc-123', { mode: 'navigate' })).toBe(true);
    expect(matches('pages', 'https://app.example.com/trip/abc-123/plan', { mode: 'navigate' })).toBe(true);
    expect(matches('pages', 'https://app.example.com/settings', { mode: 'navigate' })).toBe(true);

    // Next's client-side RSC navigation/prefetch (request.headers.get('RSC') === '1').
    expect(matches('pages', 'https://app.example.com/trip/abc-123', { headers: { RSC: '1' } })).toBe(true);

    // Must NOT swallow API/data requests — those belong to the data SWR rule.
    expect(matches('pages', 'https://app.example.com/api/trips', { mode: 'navigate' })).toBe(false);
    expect(matches('pages', 'https://app.example.com/api/settings', { headers: { RSC: '1' } })).toBe(false);
  });

  it('orders pages (navigation cache) after the data/api rules', () => {
    const names = buildRuntimeCaching().map((e) => e.name);
    expect(names.indexOf('data')).toBeLessThan(names.indexOf('pages'));
    expect(names.indexOf('google')).toBeLessThan(names.indexOf('pages'));
    expect(names.indexOf('photos')).toBeLessThan(names.indexOf('pages'));
  });

  it('pages matcher returns false for cross-origin navigation requests', () => {
    // A cross-origin URL with sameOrigin: false must not be cached by the pages rule.
    expect(
      matches('pages', 'https://other.example.com/some-page', { mode: 'navigate', sameOrigin: false }),
    ).toBe(false);
    // Same URL but sameOrigin: true would match (sanity check).
    expect(
      matches('pages', 'https://app.example.com/some-page', { mode: 'navigate', sameOrigin: true }),
    ).toBe(true);
  });
});

describe('buildRuntimeCaching under a /burgergo sub-path', () => {
  const base = '/burgergo';

  it('matches prefixed data paths and rejects the unprefixed (root) ones', () => {
    expect(matches('data', 'https://app.example.com/burgergo/api/trips', { base })).toBe(true);
    expect(matches('data', 'https://app.example.com/burgergo/api/trips/abc-123', { base })).toBe(true);
    expect(matches('data', 'https://app.example.com/burgergo/api/settings', { base })).toBe(true);
    // Unprefixed root paths must NOT match when deployed under /burgergo.
    expect(matches('data', 'https://app.example.com/api/trips', { base })).toBe(false);
    expect(matches('data', 'https://app.example.com/burgergo/api/health', { base })).toBe(false);
  });

  it('matches prefixed photo/icon/logo paths', () => {
    expect(matches('photos', 'https://app.example.com/burgergo/burgergo-logo.png', { base })).toBe(true);
    expect(matches('photos', 'https://app.example.com/burgergo/icons/icon-192.png', { base })).toBe(true);
    expect(matches('photos', 'https://app.example.com/burgergo/api/photos/p1/card', { base })).toBe(true);
    expect(matches('photos', 'https://app.example.com/icons/icon-192.png', { base })).toBe(false);
  });

  it('matches the prefixed Google proxy and still matches Google/Maps origins', () => {
    expect(matches('google', 'https://app.example.com/burgergo/api/google/details', { base })).toBe(true);
    expect(matches('google', 'https://maps.googleapis.com/maps/api/js', { base })).toBe(true);
    expect(matches('google', 'https://app.example.com/api/google/details', { base })).toBe(false);
  });

  it('caches prefixed navigations under pages but excludes prefixed /api/*', () => {
    expect(matches('pages', 'https://app.example.com/burgergo/', { mode: 'navigate', base })).toBe(true);
    expect(matches('pages', 'https://app.example.com/burgergo/trip/abc-123/plan', { mode: 'navigate', base })).toBe(true);
    expect(matches('pages', 'https://app.example.com/burgergo/api/trips', { mode: 'navigate', base })).toBe(false);
  });
});

describe('swBasePath', () => {
  // The SW is served at `<basePath>/sw.js`, so its base is its own path minus
  // the `/sw.js` suffix. We drive `self.location.href` to verify both deploys.
  function withSelfLocation<T>(href: string | undefined, fn: () => T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    const original = g.self;
    g.self = href === undefined ? undefined : { location: { href } };
    try {
      return fn();
    } finally {
      g.self = original;
    }
  }

  it('returns "" at the root deploy (served at /sw.js)', () => {
    expect(withSelfLocation('https://app.example.com/sw.js', swBasePath)).toBe('');
  });

  it('returns the sub-path when served under /burgergo/sw.js', () => {
    expect(withSelfLocation('https://app.example.com/burgergo/sw.js', swBasePath)).toBe('/burgergo');
  });

  it('falls back to "" when self.location is unavailable', () => {
    expect(withSelfLocation(undefined, swBasePath)).toBe('');
  });
});
