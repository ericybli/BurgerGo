// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getPrincipal } from '@/src/lib/authz';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as CREATE_CATEGORY } from '@/app/api/trips/[tripId]/packing/categories/route';
import {
  PATCH as PATCH_CATEGORY,
  DELETE as DELETE_CATEGORY,
} from '@/app/api/trips/[tripId]/packing/categories/[categoryId]/route';
import { POST as CREATE_ITEM } from '@/app/api/trips/[tripId]/packing/items/route';
import {
  PATCH as PATCH_ITEM,
  DELETE as DELETE_ITEM,
} from '@/app/api/trips/[tripId]/packing/items/[itemId]/route';

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

describe('packing write API', () => {
  it('category: create → rename → delete round-trip', async () => {
    const created = await CREATE_CATEGORY(req({ name: 'Clothes' }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const id = (await created.json()).category.id as string;

    const patched = await PATCH_CATEGORY(req({ name: 'Outfits' }), P({ tripId: 't1', categoryId: id }));
    expect(patched.status).toBe(200);
    expect((await patched.json()).category.name).toBe('Outfits');

    const del = await DELETE_CATEGORY(
      new Request('http://x', { method: 'DELETE' }),
      P({ tripId: 't1', categoryId: id }),
    );
    expect(del.status).toBe(200);
  });

  it('item: create → patch (pack) → delete round-trip', async () => {
    const cat = await CREATE_CATEGORY(req({ name: 'Clothes' }), P({ tripId: 't1' }));
    const categoryId = (await cat.json()).category.id as string;

    const created = await CREATE_ITEM(req({ categoryId, name: 'Socks', quantity: 2 }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const item = (await created.json()).item;
    expect(item.quantity).toBe(2);
    expect(item.packed).toBe(false);
    const id = item.id as string;

    const patched = await PATCH_ITEM(req({ packed: true }), P({ tripId: 't1', itemId: id }));
    expect(patched.status).toBe(200);
    expect((await patched.json()).item.packed).toBe(true);

    const del = await DELETE_ITEM(
      new Request('http://x', { method: 'DELETE' }),
      P({ tripId: 't1', itemId: id }),
    );
    expect(del.status).toBe(200);
  });

  it('category: PATCH a missing id → 404', async () => {
    const res = await PATCH_CATEGORY(req({ name: 'x' }), P({ tripId: 't1', categoryId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('item: PATCH a missing id → 404', async () => {
    const res = await PATCH_ITEM(req({ packed: true }), P({ tripId: 't1', itemId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('item: create under a missing category → 404', async () => {
    const res = await CREATE_ITEM(req({ categoryId: 'nope', name: 'Socks' }), P({ tripId: 't1' }));
    expect(res.status).toBe(404);
  });

  it('category: create on a missing trip → 404', async () => {
    const res = await CREATE_CATEGORY(req({ name: 'Clothes' }), P({ tripId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await CREATE_CATEGORY(req({ name: 'x' }), P({ tripId: 't1' }));
    expect(noAuth.status).toBe(401);
    const withAuth = await CREATE_CATEGORY(req({ name: 'x' }), P({ tripId: 't1' }));
    expect(withAuth.status).toBe(200);
  });
});
