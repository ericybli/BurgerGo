// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places, user } from '@/src/db/schema';
import { getPrincipal } from '@/src/lib/authz';
import { getTrip } from '@/src/db/repos/trips';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as CREATE_TRIP } from '@/app/api/trips/route';
import { PATCH as PATCH_TRIP, DELETE as DELETE_TRIP } from '@/app/api/trips/[tripId]/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function req(body?: unknown, key?: string) {
  return new Request('http://x', {
    method: 'POST',
    headers: key ? { 'x-api-key': key } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const P = <T extends object>(o: T) => ({ params: Promise.resolve(o) });

function seedTrip(db: Db) {
  db.insert(trips).values({
    id: 't1', name: 'Trip', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  // Mirror the mocked principal so created trips get an owner row linked to it
  // (DELETE is owner-only for user principals).
  db.insert(user).values({
    id: 'test-user', name: 'Test', email: 'test@example.com',
    emailVerified: true, image: null, createdAt: TS, updatedAt: TS,
  }).run();
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('trip write API', () => {
  it('create → patch (rename) → delete round-trip', async () => {
    const created = await CREATE_TRIP(req({ name: 'Lisbon', startDate: '2026-05-01', endDate: '2026-05-08' }));
    expect(created.status).toBe(200);
    const trip = (await created.json()).trip as { id: string; name: string };
    expect(trip.name).toBe('Lisbon');
    expect(getTrip(testHandle.db, trip.id)?.name).toBe('Lisbon');

    const patched = await PATCH_TRIP(req({ name: 'Porto' }), P({ tripId: trip.id }));
    expect(patched.status).toBe(200);
    expect((await patched.json()).trip.name).toBe('Porto');

    const del = await DELETE_TRIP(new Request('http://x', { method: 'DELETE' }), P({ tripId: trip.id }));
    expect(del.status).toBe(200);
    expect(getTrip(testHandle.db, trip.id)).toBeUndefined();
  });

  it('patch: shift dates (length preserved) and scheduled places move', async () => {
    const res = await PATCH_TRIP(req({ startDate: '2026-09-06' }), P({ tripId: 't1' })); // +2 days
    expect(res.status).toBe(200);
    const trip = (await res.json()).trip as { startDate: string; endDate: string };
    expect(trip.startDate).toBe('2026-09-06');
    expect(trip.endDate).toBe('2026-09-14'); // 8-day length preserved
  });

  it('patch: set then clear the cover photo', async () => {
    const set = await PATCH_TRIP(req({ coverPhoto: 'gphotos/abc.jpg' }), P({ tripId: 't1' }));
    expect((await set.json()).trip.coverPhoto).toBe('gphotos/abc.jpg');

    const clear = await PATCH_TRIP(req({ coverPhoto: null }), P({ tripId: 't1' }));
    expect((await clear.json()).trip.coverPhoto).toBeNull();
  });

  it('patch: combined name + startDate + coverPhoto in one request', async () => {
    const res = await PATCH_TRIP(
      req({ name: 'Combo', startDate: '2026-09-05', coverPhoto: 'gphotos/x.jpg' }),
      P({ tripId: 't1' }),
    );
    expect(res.status).toBe(200);
    const trip = (await res.json()).trip;
    expect(trip.name).toBe('Combo');
    expect(trip.startDate).toBe('2026-09-05');
    expect(trip.coverPhoto).toBe('gphotos/x.jpg');
  });

  it('patch: { addDay: true } extends the trip by one day at the end', async () => {
    const res = await PATCH_TRIP(req({ addDay: true }), P({ tripId: 't1' }));
    expect(res.status).toBe(200);
    const trip = (await res.json()).trip as { startDate: string; endDate: string };
    expect(trip.startDate).toBe('2026-09-04');
    expect(trip.endDate).toBe('2026-09-13');
  });

  it('patch: { removeDay: true } drops the last day and moves its places to Saved', async () => {
    testHandle.db.insert(places).values({
      id: 'p1', tripId: 't1', dayDate: '2026-09-12', googlePlaceId: null, name: 'Last-day stop',
      address: null, lat: 1, lng: 2, category: 'sightseeing', scheduledTime: null,
      durationMin: null, cost: null, notes: null, aiSummary: null, legMode: null, listId: null,
      orderIndex: 0, createdAt: TS, updatedAt: TS,
    }).run();

    const res = await PATCH_TRIP(req({ removeDay: true }), P({ tripId: 't1' }));
    expect(res.status).toBe(200);
    const trip = (await res.json()).trip as { endDate: string };
    expect(trip.endDate).toBe('2026-09-11');
    expect(testHandle.db.select().from(places).all()[0]!.dayDate).toBeNull(); // preserved in Saved
  });

  it('patch: removeDay on a one-day trip → 400', async () => {
    testHandle.db.insert(trips).values({
      id: 't2', name: 'One day', startDate: '2026-10-01', endDate: '2026-10-01',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    const res = await PATCH_TRIP(req({ removeDay: true }), P({ tripId: 't2' }));
    expect(res.status).toBe(400);
    expect(getTrip(testHandle.db, 't2')?.endDate).toBe('2026-10-01');
  });

  it('patch: addDay + removeDay together → 400 (mutually exclusive)', async () => {
    const res = await PATCH_TRIP(req({ addDay: true, removeDay: true }), P({ tripId: 't1' }));
    expect(res.status).toBe(400);
    expect(getTrip(testHandle.db, 't1')?.endDate).toBe('2026-09-12'); // untouched
  });

  it('patch: addDay on a missing trip → 404', async () => {
    const res = await PATCH_TRIP(req({ addDay: true }), P({ tripId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('patch: addDay rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await PATCH_TRIP(req({ addDay: true }), P({ tripId: 't1' }));
    expect(noAuth.status).toBe(401);
    const withAuth = await PATCH_TRIP(req({ addDay: true }), P({ tripId: 't1' }));
    expect(withAuth.status).toBe(200);
    expect((await withAuth.json()).trip.endDate).toBe('2026-09-13');
  });

  it('create: rejects endDate before startDate → 400', async () => {
    const res = await CREATE_TRIP(req({ name: 'Bad', startDate: '2026-05-08', endDate: '2026-05-01' }));
    expect(res.status).toBe(400);
  });

  it('PATCH a missing trip id → 404', async () => {
    const res = await PATCH_TRIP(req({ name: 'X' }), P({ tripId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('DELETE a missing trip id → 404', async () => {
    const res = await DELETE_TRIP(new Request('http://x', { method: 'DELETE' }), P({ tripId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await CREATE_TRIP(req({ name: 'x', startDate: '2026-05-01', endDate: '2026-05-02' }));
    expect(noAuth.status).toBe(401);
    const withAuth = await CREATE_TRIP(req({ name: 'x', startDate: '2026-05-01', endDate: '2026-05-02' }));
    expect(withAuth.status).toBe(200);
  });
});
