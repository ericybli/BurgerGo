// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, dayModes } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
// The wrapped Server Actions call revalidatePath; stub it (no request cache in tests).
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { PATCH, DELETE } from '@/app/api/trips/[tripId]/places/[placeId]/route';
import { POST as MOVE } from '@/app/api/trips/[tripId]/places/[placeId]/move/route';
import { POST as REORDER } from '@/app/api/trips/[tripId]/days/[date]/reorder/route';
import { PUT as SET_MODE } from '@/app/api/trips/[tripId]/days/[date]/mode/route';
import { POST as RECOMPUTE } from '@/app/api/trips/[tripId]/days/[date]/recompute/route';
import { POST as CREATE } from '@/app/api/trips/[tripId]/places/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function seedTrip(db: Db) {
  db.insert(trips).values({
    id: 't1', name: 'Trip', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}
function seedPlace(db: Db, over: Partial<typeof places.$inferInsert> = {}) {
  const row = {
    id: 'p1', tripId: 't1', dayDate: '2026-09-04', googlePlaceId: null, name: 'A',
    address: null, lat: 1, lng: 2, category: 'sightseeing' as const, scheduledTime: null,
    durationMin: null, cost: null, notes: null, aiSummary: null, legMode: null, listId: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS, ...over,
  };
  db.insert(places).values(row).run();
  return row;
}
const req = (body?: unknown) =>
  new Request('http://x', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
});

describe('places write API', () => {
  it('PATCH updates fields (name + cost) and returns the place', async () => {
    seedPlace(testHandle.db);
    const res = await PATCH(req({ name: 'Renamed', cost: 4200 }), {
      params: Promise.resolve({ tripId: 't1', placeId: 'p1' }),
    });
    expect(res.status).toBe(200);
    const { place } = (await res.json()) as { place: { name: string; cost: number } };
    expect(place.name).toBe('Renamed');
    expect(place.cost).toBe(4200);
  });

  it('PATCH 404s when the place belongs to another trip', async () => {
    seedPlace(testHandle.db, { id: 'p1', tripId: 't1' });
    const res = await PATCH(req({ name: 'x' }), {
      params: Promise.resolve({ tripId: 'other', placeId: 'p1' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH 400s on an invalid patch', async () => {
    seedPlace(testHandle.db);
    const res = await PATCH(req({ category: 'not-a-category' }), {
      params: Promise.resolve({ tripId: 't1', placeId: 'p1' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE removes the place', async () => {
    seedPlace(testHandle.db);
    const res = await DELETE(req(), { params: Promise.resolve({ tripId: 't1', placeId: 'p1' }) });
    expect(res.status).toBe(200);
    expect(testHandle.db.select().from(places).all()).toHaveLength(0);
  });

  it('move → Saved bucket sets dayDate null; move → day sets it', async () => {
    seedPlace(testHandle.db, { dayDate: '2026-09-04' });
    const toSaved = await MOVE(req({ dayDate: null }), {
      params: Promise.resolve({ tripId: 't1', placeId: 'p1' }),
    });
    expect(toSaved.status).toBe(200);
    expect((await toSaved.json()).place.dayDate).toBeNull();

    const toDay = await MOVE(req({ dayDate: '2026-09-06' }), {
      params: Promise.resolve({ tripId: 't1', placeId: 'p1' }),
    });
    expect((await toDay.json()).place.dayDate).toBe('2026-09-06');
  });

  it('reorder accepts the ordered id list', async () => {
    seedPlace(testHandle.db, { id: 'p1', orderIndex: 0 });
    seedPlace(testHandle.db, { id: 'p2', orderIndex: 1, name: 'B' });
    const res = await REORDER(req({ orderedIds: ['p2', 'p1'] }), {
      params: Promise.resolve({ tripId: 't1', date: '2026-09-04' }),
    });
    expect(res.status).toBe(200);
    const byId = Object.fromEntries(testHandle.db.select().from(places).all().map((p) => [p.id, p.orderIndex]));
    expect(byId.p2).toBeLessThan(byId.p1!);
  });

  it('PUT mode persists the day default travel mode', async () => {
    const res = await SET_MODE(req({ mode: 'transit' }), {
      params: Promise.resolve({ tripId: 't1', date: '2026-09-04' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).dayMode.mode).toBe('transit');
    expect(testHandle.db.select().from(dayModes).all()[0]!.mode).toBe('transit');
  });

  it('recompute returns legs (empty without a Google key in tests)', async () => {
    seedPlace(testHandle.db, { id: 'p1', orderIndex: 0 });
    seedPlace(testHandle.db, { id: 'p2', orderIndex: 1, name: 'B', lat: 3, lng: 4 });
    const res = await RECOMPUTE(req({ mode: 'drive' }), {
      params: Promise.resolve({ tripId: 't1', date: '2026-09-04' }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).legs).toEqual([]);
  });

  it('create adds a place to a day with explicit coords (native path)', async () => {
    const res = await CREATE(
      req({ name: 'Beach', category: 'sightseeing', dayDate: '2026-09-05', lat: 19.6, lng: -155.9 }),
      { params: Promise.resolve({ tripId: 't1' }) },
    );
    expect(res.status).toBe(201);
    const { place } = (await res.json()) as { place: { dayDate: string; lat: number; name: string } };
    expect(place).toMatchObject({ name: 'Beach', dayDate: '2026-09-05', lat: 19.6 });
  });
});
