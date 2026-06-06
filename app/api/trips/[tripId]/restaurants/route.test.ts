import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, restaurants } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/restaurants/route';

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
