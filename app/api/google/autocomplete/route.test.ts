import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));

import { GET } from '@/app/api/google/autocomplete/route';

function req(qs: string) {
  return new Request(`http://x/api/google/autocomplete?${qs}`);
}

describe('GET /api/google/autocomplete', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('returns an empty list when input is missing (no Google call)', async () => {
    const res = await GET(req(''));
    expect(await res.json()).toEqual({ predictions: [] });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('proxies to Google with the server key + session token and returns predictions', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        predictions: [{ place_id: 'p1', description: 'Senso-ji Temple, Tokyo' }],
      }),
    });
    const res = await GET(req('input=senso&sessionToken=sess-1'));
    expect(await res.json()).toEqual({
      predictions: [{ placeId: 'p1', description: 'Senso-ji Temple, Tokyo' }],
    });
    const url = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    expect(url.searchParams.get('input')).toBe('senso');
    expect(url.searchParams.get('key')).toBe('SERVER_KEY');
    expect(url.searchParams.get('sessiontoken')).toBe('sess-1');
  });

  it('degrades to an empty list (not 5xx) when Google fails', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('network'));
    const res = await GET(req('input=senso'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ predictions: [] });
  });
});
