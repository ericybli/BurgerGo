import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, tasks } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/tasks/route';

const TS = new Date('2026-06-08T12:00:00.000Z');
function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/tasks', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    testHandle.db.insert(trips).values({
      id: 't1', name: 'T', startDate: '2026-06-05', endDate: '2026-06-07',
      coverPhoto: null, createdAt: TS, updatedAt: TS,
    }).run();
    testHandle.db.insert(tasks).values([
      { id: 'k2', tripId: 't1', title: 'Second', note: null, done: false, orderIndex: 1, createdAt: TS, updatedAt: TS },
      { id: 'k1', tripId: 't1', title: 'First', note: 'n', done: true, orderIndex: 0, createdAt: TS, updatedAt: TS },
    ]).run();
  });

  it('returns the trip tasks in orderIndex order', async () => {
    const res = await GET(new Request('http://x/api/trips/t1/tasks'), ctx('t1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tasks: Array<{ id: string; done: boolean }> };
    expect(body.tasks.map((t) => t.id)).toEqual(['k1', 'k2']);
    expect(body.tasks[0]!.done).toBe(true);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://x/api/trips/nope/tasks'), ctx('nope'));
    expect(res.status).toBe(404);
  });
});
