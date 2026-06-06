import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, travelLegs, placeDetailsCache } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/places/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values([
    {
      id: 'b', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: 'gpid-b',
      name: 'Castle', address: null, lat: 34.9, lng: 135.7, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 1, createdAt: TS, updatedAt: TS,
    },
    {
      id: 'a', tripId: 'trip-1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'Shrine', address: null, lat: 34.8, lng: 135.6, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    },
    {
      id: 's', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
      name: 'Museum', address: null, lat: null, lng: null, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    },
  ]).run();
  // Cache row for place 'b' (has a local photo path).
  db.insert(placeDetailsCache).values({
    googlePlaceId: 'gpid-b',
    name: 'Castle',
    address: 'Osaka Castle',
    lat: 34.9,
    lng: 135.7,
    categoryGuess: 'sightseeing',
    photoRef: 'R',
    photoLocalPath: 'place-photos/gpid-b/card.webp',
    rawJson: '{}',
    fetchedAt: TS,
  }).run();
  db.insert(travelLegs).values({
    id: 'leg-1', tripId: 'trip-1', fromPlaceId: 'a', toPlaceId: 'b',
    mode: 'walk', durationSeconds: 600, distanceMeters: 750,
    polyline: 'POLY_AB', computedAt: TS,
  }).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/places', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 200 with PlaceDTO array (sorted) and LegDTO array with polyline', async () => {
    const res = await GET(
      new Request('http://x/api/trips/trip-1/places'),
      ctx('trip-1'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      places: Array<{ id: string; dayDate: string | null; orderIndex: number; photoPath: string | null }>;
      legs: Array<{ id: string; fromPlaceId: string; toPlaceId: string; mode: string; polyline: string | null }>;
    };
    // dayDate asc, NULLs last, then orderIndex: a(0), b(1), s(null).
    expect(body.places.map((p) => p.id)).toEqual(['a', 'b', 's']);
    // photoPath from place_details_cache for place with googlePlaceId 'gpid-b'.
    expect(body.places.find((p) => p.id === 'b')?.photoPath).toBe('place-photos/gpid-b/card.webp');
    // No cache row for place 'a' or 's'.
    expect(body.places.find((p) => p.id === 'a')?.photoPath).toBeNull();
    expect(body.places.find((p) => p.id === 's')?.photoPath).toBeNull();
    // Leg with polyline.
    expect(body.legs).toHaveLength(1);
    expect(body.legs[0]).toMatchObject({
      id: 'leg-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', polyline: 'POLY_AB',
    });
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://x/api/trips/nope/places'), ctx('nope'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('returns empty arrays for a trip with no places', async () => {
    testHandle.db = makeTestDb().db;
    testHandle.db.insert(trips).values({
      id: 'trip-empty', name: 'Empty', startDate: '2026-06-05', endDate: '2026-06-05',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(
      new Request('http://x/api/trips/trip-empty/places'),
      ctx('trip-empty'),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ places: [], legs: [] });
  });
});
