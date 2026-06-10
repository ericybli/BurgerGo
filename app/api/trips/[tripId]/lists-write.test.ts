// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import { listByTrip } from '@/src/db/repos/savedLists';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as CREATE_LIST } from '@/app/api/trips/[tripId]/lists/route';
import { PATCH as PATCH_LIST, DELETE as DELETE_LIST } from '@/app/api/trips/[tripId]/lists/[listId]/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function req(body?: unknown, key?: string) {
  return new Request('http://x', {
    method: 'POST',
    headers: key ? { 'x-api-key': key } : {},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const del = () => new Request('http://x', { method: 'DELETE' });
const P = <T extends object>(o: T) => ({ params: Promise.resolve(o) });

function seedTrip(db: Db, id = 't1') {
  db.insert(trips).values({
    id, name: 'Trip', startDate: '2026-09-04', endDate: '2026-09-12',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('saved-place lists write API', () => {
  it('create → rename → delete round-trip', async () => {
    const created = await CREATE_LIST(req({ name: 'Beaches' }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const list = (await created.json()).list as { id: string; name: string };
    expect(list.name).toBe('Beaches');
    expect(list.id).toBeTruthy();

    const patched = await PATCH_LIST(req({ name: 'Coves' }), P({ tripId: 't1', listId: list.id }));
    expect(patched.status).toBe(200);
    expect(await patched.json()).toEqual({ ok: true });
    expect(listByTrip(testHandle.db, 't1')[0]!.name).toBe('Coves');

    const deleted = await DELETE_LIST(del(), P({ tripId: 't1', listId: list.id }));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
    expect(listByTrip(testHandle.db, 't1')).toHaveLength(0);
  });

  it('delete un-groups member places (never deletes them)', async () => {
    const created = await CREATE_LIST(req({ name: 'Food halls' }), P({ tripId: 't1' }));
    const { id } = (await created.json()).list as { id: string };
    testHandle.db.insert(places).values({
      id: 'p1', tripId: 't1', dayDate: null, listId: id, name: 'Market', address: null,
      lat: null, lng: null, category: 'other', notes: null, orderIndex: 0,
      createdAt: TS, updatedAt: TS,
    }).run();

    const res = await DELETE_LIST(del(), P({ tripId: 't1', listId: id }));
    expect(res.status).toBe(200);
    const row = testHandle.db.select().from(places).all()[0]!;
    expect(row.name).toBe('Market');
    expect(row.listId).toBeNull();
  });

  it('create: missing/empty name → 400; unknown trip → 404', async () => {
    expect((await CREATE_LIST(req({}), P({ tripId: 't1' }))).status).toBe(400);
    expect((await CREATE_LIST(req({ name: '   ' }), P({ tripId: 't1' }))).status).toBe(400);
    expect((await CREATE_LIST(req({ name: 'x' }), P({ tripId: 'nope' }))).status).toBe(404);
  });

  it('PATCH / DELETE a missing list id → 404; wrong trip → 404', async () => {
    expect((await PATCH_LIST(req({ name: 'x' }), P({ tripId: 't1', listId: 'nope' }))).status).toBe(404);
    expect((await DELETE_LIST(del(), P({ tripId: 't1', listId: 'nope' }))).status).toBe(404);

    seedTrip(testHandle.db, 't2');
    const created = await CREATE_LIST(req({ name: 'Mine' }), P({ tripId: 't1' }));
    const { id } = (await created.json()).list as { id: string };
    expect((await PATCH_LIST(req({ name: 'x' }), P({ tripId: 't2', listId: id }))).status).toBe(404);
    expect((await DELETE_LIST(del(), P({ tripId: 't2', listId: id }))).status).toBe(404);
    expect(listByTrip(testHandle.db, 't1')).toHaveLength(1); // untouched
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    const noKey = await CREATE_LIST(req({ name: 'x' }), P({ tripId: 't1' }));
    expect(noKey.status).toBe(401);
    const withKey = await CREATE_LIST(req({ name: 'x' }, 'secret'), P({ tripId: 't1' }));
    expect(withKey.status).toBe(200);
  });
});
