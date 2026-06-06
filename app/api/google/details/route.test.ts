import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { placeDetailsCache } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

import { GET } from '@/app/api/google/details/route';

function req(qs: string) {
  return new Request(`http://x/api/google/details?${qs}`);
}

describe('GET /api/google/details', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  it('returns 400 when placeId is missing', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('cache MISS: calls Google, writes the cache row, returns normalized details', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: {
          place_id: 'gpid-1',
          name: 'Senso-ji Temple',
          formatted_address: 'Asakusa',
          geometry: { location: { lat: 35.7, lng: 139.8 } },
          types: ['tourist_attraction'],
          photos: [{ photo_reference: 'R' }],
        },
      }),
    });

    const res = await GET(req('placeId=gpid-1&sessionToken=sess-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      googlePlaceId: string; categoryGuess: string; cached: boolean;
    };
    expect(body.googlePlaceId).toBe('gpid-1');
    expect(body.categoryGuess).toBe('sightseeing');
    expect(body.cached).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Cache row was written.
    expect(testHandle.db.select().from(placeDetailsCache).all().length).toBe(1);
  });

  it('cache HIT: does not call Google and returns cached:true', async () => {
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-1',
      name: 'Cached Name',
      address: 'Cached Addr',
      lat: 1,
      lng: 2,
      categoryGuess: 'lodging',
      photoRef: 'cref',
      photoLocalPath: null,
      rawJson: '{}',
      fetchedAt: new Date(1_699_000_000_000),
    }).run();

    const res = await GET(req('placeId=gpid-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; cached: boolean; categoryGuess: string };
    expect(body.name).toBe('Cached Name');
    expect(body.categoryGuess).toBe('lodging');
    expect(body.cached).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('Google fails with NO cache row: returns 502 soft error', async () => {
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'REQUEST_DENIED' }) });
    const res = await GET(req('placeId=missing'));
    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ error: 'google_unavailable' });
  });

  it('Google fails WITH a stale cache row: serves the cached value', async () => {
    testHandle.db.insert(placeDetailsCache).values({
      googlePlaceId: 'gpid-2',
      name: 'Stale But Good',
      address: 'A',
      lat: 1,
      lng: 2,
      categoryGuess: 'other',
      photoRef: null,
      photoLocalPath: null,
      rawJson: '{}',
      fetchedAt: new Date(1_699_000_000_000),
    }).run();
    fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'OVER_QUERY_LIMIT' }) });

    const res = await GET(req('placeId=gpid-2&refresh=1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; cached: boolean };
    expect(body.name).toBe('Stale But Good');
    expect(body.cached).toBe(true);
  });
});
