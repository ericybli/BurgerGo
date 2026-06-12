// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getPrincipal } from '@/src/lib/authz';
import { trips } from '@/src/db/schema';
import { getPhotoList, listByTrip } from '@/src/db/repos/photoLists';
import { addPhoto, listByOwner } from '@/src/db/repos/photos';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/src/env', () => ({ env: { UPLOADS_DIR: '/uploads' } }));

// Deleting a list removes its photos' bytes from disk; capture instead of touching fs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rmFn = vi.fn(async (..._args: any[]) => undefined);
vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, rm: (path: string, opts?: unknown) => rmFn(path, opts) };
});

import { POST as CREATE_LIST } from '@/app/api/trips/[tripId]/photo-lists/route';
import { PATCH as PATCH_LIST, DELETE as DELETE_LIST } from '@/app/api/trips/[tripId]/photo-lists/[listId]/route';

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
  rmFn.mockClear();
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('photo lists write API', () => {
  it('create → rename → delete round-trip', async () => {
    const created = await CREATE_LIST(req({ name: 'Sunsets' }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const list = (await created.json()).list as { id: string; name: string };
    expect(list.name).toBe('Sunsets');
    expect(list.id).toBeTruthy();

    const patched = await PATCH_LIST(req({ name: 'Golden hour' }), P({ tripId: 't1', listId: list.id }));
    expect(patched.status).toBe(200);
    expect(await patched.json()).toEqual({ ok: true });
    expect(getPhotoList(testHandle.db, list.id)?.name).toBe('Golden hour');

    const deleted = await DELETE_LIST(del(), P({ tripId: 't1', listId: list.id }));
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
    expect(listByTrip(testHandle.db, 't1')).toHaveLength(0);
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
    expect(getPhotoList(testHandle.db, id)).toBeDefined(); // untouched
  });

  it('delete removes the list photos (rows + on-disk bytes)', async () => {
    const created = await CREATE_LIST(req({ name: 'Birds' }), P({ tripId: 't1' }));
    const { id } = (await created.json()).list as { id: string };
    const photo = addPhoto(testHandle.db, { tripId: 't1', ownerType: 'photo_list', ownerId: id });

    const res = await DELETE_LIST(del(), P({ tripId: 't1', listId: id }));
    expect(res.status).toBe(200);
    expect(rmFn).toHaveBeenCalledWith(`/uploads/${photo.path}`, { recursive: true, force: true });
    expect(listByOwner(testHandle.db, 'photo_list', id)).toHaveLength(0);
    expect(getPhotoList(testHandle.db, id)).toBeUndefined();
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await CREATE_LIST(req({ name: 'x' }), P({ tripId: 't1' }));
    expect(noAuth.status).toBe(401);
    const withAuth = await CREATE_LIST(req({ name: 'x' }), P({ tripId: 't1' }));
    expect(withAuth.status).toBe(200);
  });
});
