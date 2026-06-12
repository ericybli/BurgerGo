// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { getPrincipal } from '@/src/lib/authz';
import { trips } from '@/src/db/schema';
import { addRestaurant } from '@/src/db/repos/restaurants';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { POST as CREATE_EXPENSE } from '@/app/api/trips/[tripId]/expenses/route';
import { PATCH as PATCH_EXPENSE, DELETE as DELETE_EXPENSE } from '@/app/api/trips/[tripId]/expenses/[expenseId]/route';
import { PATCH as PATCH_REST, DELETE as DELETE_REST } from '@/app/api/trips/[tripId]/restaurants/[restaurantId]/route';
import { POST as SCHEDULE_REST } from '@/app/api/trips/[tripId]/restaurants/[restaurantId]/schedule/route';
import { POST as CREATE_ENTRY } from '@/app/api/trips/[tripId]/journal/route';
import { PATCH as PATCH_ENTRY, DELETE as DELETE_ENTRY } from '@/app/api/trips/[tripId]/journal/[entryId]/route';
import { POST as CREATE_TASK } from '@/app/api/trips/[tripId]/tasks/route';
import { PATCH as PATCH_TASK, DELETE as DELETE_TASK } from '@/app/api/trips/[tripId]/tasks/[taskId]/route';

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

describe('entity write API', () => {
  it('expense: create → patch → delete round-trip', async () => {
    const created = await CREATE_EXPENSE(req({ amount: 1500, category: 'food', spentOn: '2026-09-04' }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const id = (await created.json()).expense.id as string;

    const patched = await PATCH_EXPENSE(req({ amount: 2000 }), P({ tripId: 't1', expenseId: id }));
    expect((await patched.json()).expense.amount).toBe(2000);

    const del = await DELETE_EXPENSE(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', expenseId: id }));
    expect(del.status).toBe(200);
  });

  it('expense: PATCH a missing id → 404', async () => {
    const res = await PATCH_EXPENSE(req({ amount: 1 }), P({ tripId: 't1', expenseId: 'nope' }));
    expect(res.status).toBe(404);
  });

  it('restaurant: patch + schedule-to-day + delete', async () => {
    const r = addRestaurant(testHandle.db, { tripId: 't1', name: 'Cafe', status: 'want-to-try' });
    const patched = await PATCH_REST(req({ rating: 5, status: 'been' }), P({ tripId: 't1', restaurantId: r.id }));
    expect((await patched.json()).restaurant.rating).toBe(5);

    const sched = await SCHEDULE_REST(req({ dayDate: '2026-09-05' }), P({ tripId: 't1', restaurantId: r.id }));
    expect(sched.status).toBe(200);
    expect((await sched.json()).place.dayDate).toBe('2026-09-05');

    const del = await DELETE_REST(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', restaurantId: r.id }));
    expect(del.status).toBe(200);
  });

  it('journal: create → patch → delete', async () => {
    const created = await CREATE_ENTRY(req({ title: 'Day 1', body: 'Arrived in Kona.' }), P({ tripId: 't1' }));
    expect(created.status).toBe(200);
    const id = (await created.json()).entry.id as string;
    const patched = await PATCH_ENTRY(req({ title: 'Day One' }), P({ tripId: 't1', entryId: id }));
    expect((await patched.json()).entry.title).toBe('Day One');
    const del = await DELETE_ENTRY(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', entryId: id }));
    expect(del.status).toBe(200);
  });

  it('task: create → check off → delete', async () => {
    const created = await CREATE_TASK(req({ title: 'Pack passport' }), P({ tripId: 't1' }));
    const id = (await created.json()).task.id as string;
    const patched = await PATCH_TASK(req({ done: true }), P({ tripId: 't1', taskId: id }));
    expect((await patched.json()).task.done).toBe(true);
    const del = await DELETE_TASK(new Request('http://x', { method: 'DELETE' }), P({ tripId: 't1', taskId: id }));
    expect(del.status).toBe(200);
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(getPrincipal).mockResolvedValueOnce(null);
    const noAuth = await CREATE_TASK(req({ title: 'x' }), P({ tripId: 't1' }));
    expect(noAuth.status).toBe(401);
    const withAuth = await CREATE_TASK(req({ title: 'x' }), P({ tripId: 't1' }));
    expect(withAuth.status).toBe(200);
  });
});
