import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
  sqlite: {},
}));
vi.mock('@/src/env', () => ({ env: { TZ: 'UTC' } }));

// Pin "today" inside the active window of "active-1".
vi.useFakeTimers();
vi.setSystemTime(new Date('2026-06-08T12:00:00Z'));

import { GET } from '@/app/api/trips/route';

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  const ts = new Date('2026-06-08T12:00:00.000Z');
  db.insert(trips).values([
    { id: 'past-1', name: 'Past', startDate: '2026-01-01', endDate: '2026-01-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
    { id: 'active-1', name: 'Active', startDate: '2026-06-05', endDate: '2026-06-12', coverPhoto: null, createdAt: ts, updatedAt: ts },
    { id: 'upcoming-1', name: 'Upcoming', startDate: '2026-07-01', endDate: '2026-07-05', coverPhoto: null, createdAt: ts, updatedAt: ts },
  ]).run();
}

describe('GET /api/trips', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 200 with trips Active-first', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.map((t) => t.id)).toEqual(['active-1', 'past-1', 'upcoming-1']);
  });
});
