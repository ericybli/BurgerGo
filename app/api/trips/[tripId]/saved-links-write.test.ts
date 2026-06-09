// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as CREATE_LINK } from '@/app/api/trips/[tripId]/links/route';
import { PATCH as PATCH_LINK, DELETE as DELETE_LINK } from '@/app/api/trips/[tripId]/links/[linkId]/route';

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
}

beforeEach(() => {
  testHandle.db = makeTestDb().db;
  seedTrip(testHandle.db);
});
afterEach(() => {
  delete process.env.BURGERGO_API_KEY;
});

describe('saved links write API', () => {
  it('link: create → patch → delete round-trip', async () => {
    const created = await CREATE_LINK(
      req({ url: 'https://example.com', title: 'Cool spot' }),
      P({ tripId: 't1' }),
    );
    expect(created.status).toBe(200);
    const id = (await created.json()).link.id as string;

    const patched = await PATCH_LINK(req({ title: 'Cooler spot' }), P({ tripId: 't1', linkId: id }));
    expect((await patched.json()).link.title).toBe('Cooler spot');

    const del = await DELETE_LINK(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', linkId: id }));
    expect(del.status).toBe(200);
  });

  it('link: PATCH a missing id → 404', async () => {
    const res = await PATCH_LINK(req({ title: 'x' }), P({ tripId: 't1', linkId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('link: DELETE a missing id → 404', async () => {
    const res = await DELETE_LINK(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', linkId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('link: create against a missing trip → 404', async () => {
    const res = await CREATE_LINK(req({ url: 'https://example.com' }), P({ tripId: 'missing' }));
    expect(res.status).toBe(404);
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    const noKey = await CREATE_LINK(req({ url: 'https://example.com' }), P({ tripId: 't1' }));
    expect(noKey.status).toBe(401);
    const withKey = await CREATE_LINK(req({ url: 'https://example.com' }, 'secret'), P({ tripId: 't1' }));
    expect(withKey.status).toBe(200);
  });
});
