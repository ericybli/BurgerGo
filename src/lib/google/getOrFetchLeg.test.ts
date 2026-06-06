import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import { getCachedLeg } from '@/src/db/repos/legs';
import { getOrFetchLeg } from '@/src/lib/google/getOrFetchLeg';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);

type Db = ReturnType<typeof makeTestDb>['db'];

function seed(db: Db) {
  db.insert(trips).values({
    id: 'trip-1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-06',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values([
    {
      id: 'p-a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'A', address: null, lat: 35.0, lng: 139.0, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    },
    {
      id: 'p-b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'B', address: null, lat: 35.1, lng: 139.1, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 1, createdAt: TS, updatedAt: TS,
    },
  ]).run();
}

describe('getOrFetchLeg', () => {
  let db: Db;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = makeTestDb().db;
    seed(db);
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  const placeA = { id: 'p-a', tripId: 'trip-1', lat: 35.0, lng: 139.0 };
  const placeB = { id: 'p-b', tripId: 'trip-1', lat: 35.1, lng: 139.1 };

  it('cache HIT: returns the existing leg without calling Google', async () => {
    // Pre-seed a cached leg.
    const { upsertLeg } = await import('@/src/db/repos/legs');
    upsertLeg(db, {
      tripId: 'trip-1', fromPlaceId: 'p-a', toPlaceId: 'p-b', mode: 'walk',
      durationSeconds: 500, distanceMeters: 700, polyline: 'CACHED',
    });

    const leg = await getOrFetchLeg(db, placeA, placeB, 'walk', 'SERVER_KEY');
    expect(leg.durationSeconds).toBe(500);
    expect(leg.polyline).toBe('CACHED');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('cache MISS: calls Directions, upserts with polyline, returns the leg', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'OK',
        routes: [{
          overview_polyline: { points: 'FRESH_POLY' },
          legs: [{ duration: { value: 600 }, distance: { value: 800 } }],
        }],
      }),
    });

    const leg = await getOrFetchLeg(db, placeA, placeB, 'walk', 'SERVER_KEY');
    expect(leg.durationSeconds).toBe(600);
    expect(leg.polyline).toBe('FRESH_POLY');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Persisted in the cache.
    const cached = getCachedLeg(db, 'p-a', 'p-b', 'walk');
    expect(cached?.polyline).toBe('FRESH_POLY');
  });

  it('throws when places have no coordinates', async () => {
    await expect(
      getOrFetchLeg(db, { id: 'p-a', tripId: 'trip-1', lat: null, lng: null }, placeB, 'drive', 'K'),
    ).rejects.toThrow(/coordinates/i);
  });
});
