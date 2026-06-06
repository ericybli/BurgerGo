import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reverseGeocode } from '@/components/plan/googleClient';

describe('reverseGeocode', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
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
});
