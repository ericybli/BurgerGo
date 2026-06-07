import { describe, it, expect, afterEach, vi } from 'vitest';

afterEach(() => {
  delete process.env.NEXT_PUBLIC_MAP_PROVIDER;
  delete process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  vi.resetModules();
});

describe('map provider', () => {
  it('defaults to google with an empty mapbox token', async () => {
    vi.resetModules();
    const { MAP_PROVIDER, MAPBOX_TOKEN } = await import('@/src/lib/map/provider');
    expect(MAP_PROVIDER).toBe('google');
    expect(MAPBOX_TOKEN).toBe('');
  });

  it('selects mapbox + reads the token when the env vars are set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_MAP_PROVIDER = 'mapbox';
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test-token';
    const { MAP_PROVIDER, MAPBOX_TOKEN } = await import('@/src/lib/map/provider');
    expect(MAP_PROVIDER).toBe('mapbox');
    expect(MAPBOX_TOKEN).toBe('pk.test-token');
  });

  it('treats any non-mapbox value as google', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_MAP_PROVIDER = 'something-else';
    const { MAP_PROVIDER } = await import('@/src/lib/map/provider');
    expect(MAP_PROVIDER).toBe('google');
  });
});
