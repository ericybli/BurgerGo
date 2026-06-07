import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, restaurants, placeDetailsCache, photos } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET, POST } from '@/app/api/trips/[tripId]/restaurants/route';
import { listRestaurants } from '@/src/db/repos/restaurants';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 't1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'p1', tripId: 't1', dayDate: '2026-06-06', googlePlaceId: null, name: 'Ichiran',
    address: null, lat: null, lng: null, category: 'other', scheduledTime: null,
    durationMin: null, cost: null, notes: null, orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(restaurants).values([
    {
      id: 'r1', tripId: 't1', name: 'Ichiran', cuisine: 'Ramen', rating: 4,
      status: 'been', priceLevel: 2, notes: null, linkedPlaceId: 'p1',
      createdAt: new Date(2000), updatedAt: TS,
    },
    {
      id: 'r2', tripId: 't1', name: 'Kani', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      createdAt: new Date(1000), updatedAt: TS,
    },
  ]).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/restaurants', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 200 with restaurants newest-first + scheduledDayDate resolved', async () => {
    const res = await GET(new Request('http://x/api/trips/t1/restaurants'), ctx('t1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      restaurants: Array<{ id: string; scheduledDayDate: string | null }>;
    };
    expect(body.restaurants.map((r) => r.id)).toEqual(['r1', 'r2']); // createdAt desc
    expect(body.restaurants.find((r) => r.id === 'r1')?.scheduledDayDate).toBe('2026-06-06');
    expect(body.restaurants.find((r) => r.id === 'r2')?.scheduledDayDate).toBeNull();
  });

  it('resolves photoPath from place_details_cache + personal photos by owner', async () => {
    const db = testHandle.db;
    // A restaurant linked to a Google place that has a cached photo + one upload.
    db.insert(restaurants).values({
      id: 'r3', tripId: 't1', name: 'Sushi Dai', cuisine: null, rating: null,
      status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
      googlePlaceId: 'g3', createdAt: new Date(3000), updatedAt: TS,
    }).run();
    db.insert(placeDetailsCache).values({
      googlePlaceId: 'g3', name: 'Sushi Dai', address: null, lat: null, lng: null,
      categoryGuess: 'other', photoRef: 'ref', photoLocalPath: 'gphotos/g3.webp',
      rawJson: '{}', fetchedAt: TS,
    }).run();
    db.insert(photos).values({
      id: 'ph1', tripId: 't1', ownerType: 'restaurant', ownerId: 'r3',
      path: 't1/ph1', width: 800, height: 600, orderIndex: 0, createdAt: TS,
    }).run();

    const res = await GET(new Request('http://x/api/trips/t1/restaurants'), ctx('t1'));
    const body = (await res.json()) as {
      restaurants: Array<{ id: string; photoPath: string | null; photos: { id: string }[] }>;
    };
    const r3 = body.restaurants.find((r) => r.id === 'r3')!;
    expect(r3.photoPath).toBe('gphotos/g3.webp');
    expect(r3.photos.map((p) => p.id)).toEqual(['ph1']);
    // Restaurants without a Google place / uploads stay null + empty.
    const r2 = body.restaurants.find((r) => r.id === 'r2')!;
    expect(r2.photoPath).toBeNull();
    expect(r2.photos).toEqual([]);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://x/api/trips/nope/restaurants'), ctx('nope'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('returns an empty array for a trip with no restaurants', async () => {
    testHandle.db = makeTestDb().db;
    testHandle.db.insert(trips).values({
      id: 'empty', name: 'E', startDate: '2026-06-05', endDate: '2026-06-05',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await GET(new Request('http://x/api/trips/empty/restaurants'), ctx('empty'));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ restaurants: [] });
  });
});

function postReq(tripId: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://x/api/trips/${tripId}/restaurants`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/trips/[tripId]/restaurants', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    delete process.env.BURGERGO_API_KEY;
  });

  it('creates a restaurant, folding about + notes into notes', async () => {
    const res = await POST(
      postReq('t1', { name: 'Da Poke Shack', address: 'Kailua-Kona', cuisine: 'Hawaiian', about: 'Famous poke', notes: 'cash only' }),
      ctx('t1'),
    );
    expect(res.status).toBe(201);
    const body = await res.json() as { restaurant: { id: string; name: string; cuisine: string | null; status: string; notes: string | null } };
    expect(body.restaurant.name).toBe('Da Poke Shack');
    expect(body.restaurant.cuisine).toBe('Hawaiian');
    expect(body.restaurant.status).toBe('want-to-try');
    expect(body.restaurant.notes).toBe('Famous poke\n\ncash only');
    expect(listRestaurants(testHandle.db, 't1').some((r) => r.id === body.restaurant.id)).toBe(true);
  });

  it('rejects an unknown trip and invalid input', async () => {
    expect((await POST(postReq('nope', { name: 'X' }), ctx('nope'))).status).toBe(404);
    expect((await POST(postReq('t1', { rating: 9 }), ctx('t1'))).status).toBe(400);
  });

  it('requires x-api-key when BURGERGO_API_KEY is configured', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    expect((await POST(postReq('t1', { name: 'X' }), ctx('t1'))).status).toBe(401);
    const ok = await POST(postReq('t1', { name: 'X' }, { 'x-api-key': 'secret' }), ctx('t1'));
    expect(ok.status).toBe(201);
  });
});
