import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { placeDetailsCache } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { GOOGLE_MAPS_SERVER_KEY: 'SERVER_KEY', UPLOADS_DIR: '/tmp/uploads' } }));
vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));
vi.mock('@/src/lib/google/photo', () => ({ fetchAndStoreGooglePhoto: vi.fn() }));

import { GET } from '@/app/api/google/details/route';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

function req(qs: string) {
  return new Request(`http://x/api/google/details?${qs}`);
}

describe('GET /api/google/details', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const photoMock = vi.mocked(fetchAndStoreGooglePhoto);
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    photoMock.mockReset();
  });

  it('returns 400 when placeId is missing', async () => {
    const res = await GET(req(''));
    expect(res.status).toBe(400);
  });

  it('cache MISS: calls Google, downloads the photo, writes the cache row, returns normalized details', async () => {
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
    photoMock.mockResolvedValueOnce('gphotos/gpid-1.webp');

    const res = await GET(req('placeId=gpid-1&sessionToken=sess-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      googlePlaceId: string; categoryGuess: string; cached: boolean; photoLocalPath: string | null;
    };
    expect(body.googlePlaceId).toBe('gpid-1');
    expect(body.categoryGuess).toBe('sightseeing');
    expect(body.cached).toBe(false);
    expect(body.photoLocalPath).toBe('gphotos/gpid-1.webp');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // The photo download was wired with the server key + photo ref.
    expect(photoMock).toHaveBeenCalledWith({
      photoRef: 'R',
      googlePlaceId: 'gpid-1',
      apiKey: 'SERVER_KEY',
      uploadsDir: '/tmp/uploads',
    });

    // Cache row was written, with the downloaded photo path.
    const rows = testHandle.db.select().from(placeDetailsCache).all();
    expect(rows.length).toBe(1);
    expect(rows[0]!.photoLocalPath).toBe('gphotos/gpid-1.webp');
  });

  it('cache MISS with no photo: skips the download and stores a null photo path', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        result: {
          place_id: 'gpid-np',
          name: 'No Photo Place',
          formatted_address: 'Nowhere',
          geometry: { location: { lat: 1, lng: 2 } },
          types: ['lodging'],
        },
      }),
    });

    const res = await GET(req('placeId=gpid-np'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { photoLocalPath: string | null };
    expect(body.photoLocalPath).toBeNull();
    expect(photoMock).not.toHaveBeenCalled();
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
