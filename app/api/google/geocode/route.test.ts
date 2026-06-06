import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/src/db/client', () => ({ db: {}, sqlite: {} }));
vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));

import { GET } from '@/app/api/google/geocode/route';

function req(qs: string) {
  return new Request(`http://x/api/google/geocode?${qs}`);
}

describe('GET /api/google/geocode', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('returns 400 when lat or lng is missing / non-numeric / empty', async () => {
    expect((await GET(req('lat=35.1'))).status).toBe(400);
    expect((await GET(req('lat=abc&lng=139.2'))).status).toBe(400);
    // Empty strings: Number('') === 0 which is finite, so must be caught explicitly.
    expect((await GET(req('lat=&lng='))).status).toBe(400);
    expect((await GET(req('lat=35.1&lng='))).status).toBe(400);
  });

  it('returns the first formatted_address on OK', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'OK', results: [{ formatted_address: '1-1 Marunouchi, Tokyo' }] }),
    });
    const res = await GET(req('lat=35.681&lng=139.767'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ address: '1-1 Marunouchi, Tokyo' });

    const u = new URL(fetchSpy.mock.calls[0]![0] as string);
    expect(u.searchParams.get('latlng')).toBe('35.681,139.767');
    expect(u.searchParams.get('key')).toBe('SERVER_KEY');
  });

  it('returns address:null on ZERO_RESULTS', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ZERO_RESULTS', results: [] }) });
    const res = await GET(req('lat=0&lng=0'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ address: null });
  });

  it('returns 502 on a Google error status', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) });
    const res = await GET(req('lat=1&lng=2'));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ error: 'google_unavailable' });
  });
});
