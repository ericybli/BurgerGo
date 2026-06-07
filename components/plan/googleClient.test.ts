import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { reverseGeocode, forwardGeocode } from '@/components/plan/googleClient';

describe('reverseGeocode', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });

  it('calls /api/google/geocode with lat+lng and returns the address', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: '1-1 Marunouchi, Tokyo' }),
    });
    const result = await reverseGeocode(35.681, 139.767);
    expect(result).toBe('1-1 Marunouchi, Tokyo');

    const url = new URL(fetchSpy.mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toBe('/api/google/geocode');
    expect(url.searchParams.get('lat')).toBe('35.681');
    expect(url.searchParams.get('lng')).toBe('139.767');
  });

  it('returns null when address is null (ocean / unnamed coord)', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ address: null }),
    });
    expect(await reverseGeocode(0, 0)).toBeNull();
  });

  it('returns null on a non-ok response (server error / no key)', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 502 });
    expect(await reverseGeocode(1, 2)).toBeNull();
  });

  it('prefixes the proxy URL with the base path when NEXT_PUBLIC_BASE_PATH is set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { reverseGeocode: prefixed } = await import('@/components/plan/googleClient');
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ address: 'A' }) });
    await prefixed(1, 2);
    const url = new URL(fetchSpy.mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toBe('/burgergo/api/google/geocode');
  });
});

describe('forwardGeocode', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });

  it('calls /api/google/geocode with the address and returns coords', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lat: 48.85, lng: 2.35, address: 'Paris, France' }),
    });
    const result = await forwardGeocode('12 Rue de Rivoli, Paris');
    expect(result).toEqual({ lat: 48.85, lng: 2.35, address: 'Paris, France' });

    const url = new URL(fetchSpy.mock.calls[0]![0] as string, 'http://x');
    expect(url.pathname).toBe('/api/google/geocode');
    expect(url.searchParams.get('address')).toBe('12 Rue de Rivoli, Paris');
  });

  it('returns null when the proxy reports no coordinates', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ lat: null, lng: null, address: null }),
    });
    expect(await forwardGeocode('nowhere')).toBeNull();
  });

  it('returns null on a non-ok response', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 502 });
    expect(await forwardGeocode('x')).toBeNull();
  });

  it('returns null for a blank address without fetching', async () => {
    expect(await forwardGeocode('   ')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
