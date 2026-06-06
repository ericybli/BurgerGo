import { describe, it, expect } from 'vitest';
import { buildRuntimeCaching } from './sw';

function matcher(name: string) {
  const entry = buildRuntimeCaching().find((e) => e.name === name);
  if (!entry) throw new Error(`no runtimeCaching entry named ${name}`);
  return entry;
}

function matches(
  name: string,
  url: string,
  init?: { mode?: RequestMode; headers?: Record<string, string>; sameOrigin?: boolean },
): boolean {
  const entry = matcher(name);
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
