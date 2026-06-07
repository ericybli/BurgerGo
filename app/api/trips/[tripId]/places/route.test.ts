import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, travelLegs, placeDetailsCache, photos, savedLinks, dayModes } from '@/src/db/schema';

const SEEDED_PLACE_ID = 'b';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET, POST } from '@/app/api/trips/[tripId]/places/route';
import { listAllForTrip } from '@/src/db/repos/places';

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

  it('returns 200 with a sorted PlaceDTO array; the light payload omits route polylines', async () => {
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
    // Leg present, but its (heavy) polyline is dropped from the light payload.
    expect(body.legs).toHaveLength(1);
    expect(body.legs[0]).toMatchObject({
      id: 'leg-1', fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk', polyline: null,
    });
  });

  it('ships the route polyline only when ?detail=full is requested', async () => {
    const res = await GET(
      new Request('http://x/api/trips/trip-1/places?detail=full'),
      ctx('trip-1'),
    );
    const body = (await res.json()) as { legs: Array<{ id: string; polyline: string | null }> };
    expect(body.legs[0]?.polyline).toBe('POLY_AB');
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
    await expect(res.json()).resolves.toEqual({ places: [], legs: [], dayModes: {} });
  });

  it('returns stored per-day default modes as a { dayDate: mode } map', async () => {
    testHandle.db.insert(dayModes).values([
      { tripId: 'trip-1', dayDate: '2026-06-05', mode: 'drive', updatedAt: TS },
      { tripId: 'trip-1', dayDate: '2026-06-06', mode: 'transit', updatedAt: TS },
    ]).run();
    const res = await GET(new Request('http://x/api/trips/trip-1/places'), ctx('trip-1'));
    const body = (await res.json()) as { dayModes: Record<string, string> };
    expect(body.dayModes).toEqual({ '2026-06-05': 'drive', '2026-06-06': 'transit' });
  });

  it('attaches ordered personal photos to each PlaceDTO', async () => {
    testHandle.db.insert(photos).values([
      { id: 'ph-b', tripId: 'trip-1', ownerType: 'place', ownerId: SEEDED_PLACE_ID, path: `trip-1/ph-b`, width: 800, height: 600, orderIndex: 1, createdAt: TS },
      { id: 'ph-a', tripId: 'trip-1', ownerType: 'place', ownerId: SEEDED_PLACE_ID, path: `trip-1/ph-a`, width: 800, height: 600, orderIndex: 0, createdAt: TS },
    ]).run();
    const res = await GET(new Request('http://x/api/trips/trip-1/places'), ctx('trip-1'));
    const body = await res.json() as { places: Array<{ id: string; photos: { id: string }[] }> };
    const target = body.places.find((p) => p.id === SEEDED_PLACE_ID)!;
    expect(target.photos.map((p) => p.id)).toEqual(['ph-a', 'ph-b']);
  });

  it('returns an empty photos array for a place with no personal photos', async () => {
    const res = await GET(new Request('http://x/api/trips/trip-1/places'), ctx('trip-1'));
    const body = await res.json() as { places: Array<{ photos: unknown[] }> };
    expect(Array.isArray(body.places[0]!.photos)).toBe(true);
  });

  it('omits aiSummary in the light payload, includes it on ?detail=full, and always attaches links', async () => {
    // Use a fresh db so we control exactly what's there
    testHandle.db = makeTestDb().db;
    testHandle.db.insert(trips).values({
      id: 't1', name: 'Test', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(places).values({
      id: 'p1', tripId: 't1', dayDate: '2026-06-05', googlePlaceId: null,
      name: 'Place', address: null, lat: null, lng: null, category: 'sightseeing',
      scheduledTime: null, durationMin: null, cost: null, notes: null, aiSummary: 'Hi',
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(savedLinks).values({
      id: 'sl1', tripId: 't1', url: 'https://x.example', title: null, note: null,
      thumbnail: null, placeId: 'p1', createdAt: TS, updatedAt: TS,
    }).run();

    // Light payload: aiSummary dropped, but links (small) are always present.
    const light = await (
      await GET(new Request('http://t/'), { params: Promise.resolve({ tripId: 't1' }) })
    ).json();
    const lp = light.places.find((x: { id: string }) => x.id === 'p1');
    expect(lp.aiSummary).toBeNull();
    expect(lp.links).toEqual([{ id: expect.any(String), url: 'https://x.example', title: null, thumbnail: null }]);

    // Full payload: aiSummary present.
    const fullBody = await (
      await GET(new Request('http://t/?detail=full'), { params: Promise.resolve({ tripId: 't1' }) })
    ).json();
    const fp = fullBody.places.find((x: { id: string }) => x.id === 'p1');
    expect(fp.aiSummary).toBe('Hi');
  });
});

function postReq(tripId: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://x/api/trips/${tripId}/places`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/trips/[tripId]/places', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    delete process.env.BURGERGO_API_KEY;
  });

  it('creates a Saved place (dayDate null) with about→aiSummary + notes', async () => {
    const res = await POST(
      postReq('trip-1', { name: 'Green Sand Beach', address: 'Naalehu HI', about: 'Olivine beach', notes: 'bring water' }),
      ctx('trip-1'),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { place: { id: string; dayDate: string | null; name: string; aiSummary: string | null; notes: string | null; category: string } };
    expect(body.place.dayDate).toBeNull(); // Saved bucket
    expect(body.place.name).toBe('Green Sand Beach');
    expect(body.place.aiSummary).toBe('Olivine beach');
    expect(body.place.notes).toBe('bring water');
    expect(body.place.category).toBe('other');
    // Persisted in the Saved bucket.
    expect(listAllForTrip(testHandle.db, 'trip-1').some((p) => p.id === body.place.id && p.dayDate === null)).toBe(true);
  });

  it('rejects an unknown trip and invalid input', async () => {
    expect((await POST(postReq('nope', { name: 'X' }), ctx('nope'))).status).toBe(404);
    expect((await POST(postReq('trip-1', { name: '' }), ctx('trip-1'))).status).toBe(400);
  });

  it('requires x-api-key when BURGERGO_API_KEY is configured', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    expect((await POST(postReq('trip-1', { name: 'X' }), ctx('trip-1'))).status).toBe(401);
    const ok = await POST(postReq('trip-1', { name: 'X' }, { 'x-api-key': 'secret' }), ctx('trip-1'));
    expect(ok.status).toBe(201);
  });
});
