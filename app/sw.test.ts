import { describe, it, expect } from 'vitest';
import { buildRuntimeCaching } from './sw';

function matcher(name: string) {
  const entry = buildRuntimeCaching().find((e) => e.name === name);
  if (!entry) throw new Error(`no runtimeCaching entry named ${name}`);
  return entry;
}

function matches(name: string, url: string): boolean {
  const entry = matcher(name);
  const request = new Request(url);
  return Boolean(
    entry.matcher({
      url: new URL(url),
      request,
      sameOrigin: new URL(url).origin === 'https://app.example.com',
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
});
