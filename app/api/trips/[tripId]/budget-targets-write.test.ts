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

import {
  PUT as SET_TARGET,
  DELETE as CLEAR_TARGET,
} from '@/app/api/trips/[tripId]/budget/targets/route';

const TS = new Date('2026-06-09T12:00:00.000Z');
type Db = ReturnType<typeof makeTestDb>['db'];

function req(body?: unknown, key?: string, method = 'PUT', url = 'http://x') {
  return new Request(url, {
    method,
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

describe('budget targets write API', () => {
  it('overall target: set → update → clear round-trip', async () => {
    const created = await SET_TARGET(req({ category: null, plannedAmount: 50000 }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const body = await created.json();
    expect(body.target.category).toBeNull();
    expect(body.target.plannedAmount).toBe(50000);
    const id = body.target.id as string;

    // Upsert: same overall row, new amount, same id.
    const updated = await SET_TARGET(req({ category: null, plannedAmount: 75000 }), P({ tripId: 't1' }));
    const updatedBody = await updated.json();
    expect(updatedBody.target.plannedAmount).toBe(75000);
    expect(updatedBody.target.id).toBe(id);

    const cleared = await CLEAR_TARGET(
      new Request('http://x', { method: 'DELETE' }),
      P({ tripId: 't1' }),
    );
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).ok).toBe(true);
  });

  it('per-category target: set → update → clear via ?category=', async () => {
    const created = await SET_TARGET(req({ category: 'food', plannedAmount: 12000 }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    expect((await created.json()).target.category).toBe('food');

    const updated = await SET_TARGET(req({ category: 'food', plannedAmount: 20000 }), P({ tripId: 't1' }));
    expect((await updated.json()).target.plannedAmount).toBe(20000);

    const cleared = await CLEAR_TARGET(
      new Request('http://x?category=food', { method: 'DELETE' }),
      P({ tripId: 't1' }),
    );
    expect(cleared.status).toBe(200);
  });

  it('PUT for a missing trip → 404', async () => {
    const res = await SET_TARGET(req({ category: null, plannedAmount: 100 }), P({ tripId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('DELETE for a missing trip → 404', async () => {
    const res = await CLEAR_TARGET(
      new Request('http://x?category=food', { method: 'DELETE' }),
      P({ tripId: 'nope' }),
    );
    expect(res.status).toBe(404);
  });

  it('PUT with an invalid category → 400', async () => {
    const res = await SET_TARGET(req({ category: 'bogus', plannedAmount: 100 }), P({ tripId: 't1' }));
    expect(res.status).toBe(400);
  });

  it('PUT with a non-positive amount → 400', async () => {
    const res = await SET_TARGET(req({ category: null, plannedAmount: 0 }), P({ tripId: 't1' }));
    expect(res.status).toBe(400);
  });

  it('enforces the write key when BURGERGO_API_KEY is set', async () => {
    process.env.BURGERGO_API_KEY = 'secret';
    const noKey = await SET_TARGET(req({ category: null, plannedAmount: 100 }), P({ tripId: 't1' }));
    expect(noKey.status).toBe(401);
    const withKey = await SET_TARGET(req({ category: null, plannedAmount: 100 }, 'secret'), P({ tripId: 't1' }));
    expect(withKey.status).toBe(200);
  });
});
