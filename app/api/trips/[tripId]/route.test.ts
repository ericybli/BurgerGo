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

import { GET } from '@/app/api/trips/[tripId]/route';

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  const ts = new Date('2026-06-08T12:00:00.000Z');
  db.insert(trips).values({
    id: 'trip-1',
    name: 'Osaka',
    startDate: '2026-06-05',
    endDate: '2026-06-07',
    coverPhoto: null,
    createdAt: ts,
    updatedAt: ts,
  }).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 200 with {trip, days} for a known trip', async () => {
    const res = await GET(new Request('http://x/api/trips/trip-1'), ctx('trip-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      trip: { id: string; name: string };
      days: Array<{ date: string; dayNumber: number }>;
    };
    expect(body.trip.id).toBe('trip-1');
    expect(body.trip.name).toBe('Osaka');
    // 2026-06-05..2026-06-07 inclusive → 3 days
    expect(body.days.map((d) => d.date)).toEqual([
      '2026-06-05',
      '2026-06-06',
      '2026-06-07',
    ]);
    expect(body.days[0]!.dayNumber).toBe(1);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://x/api/trips/nope'), ctx('nope'));
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: 'not_found' });
  });
});
