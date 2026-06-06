import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips, places } from '@/src/db/schema';
import { addExpense } from '@/src/db/repos/expenses';
import { setTarget } from '@/src/db/repos/budgetTargets';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
  sqlite: {},
}));

import { GET } from '@/app/api/trips/[tripId]/budget/route';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
  db.insert(places).values({
    id: 'p1', tripId: 'trip-1', dayDate: null, googlePlaceId: null,
    name: 'Ichiran', address: null, lat: null, lng: null, category: 'other',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, createdAt: TS, updatedAt: TS,
  }).run();
}

function ctx(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}

describe('GET /api/trips/[tripId]/budget', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
  });

  it('returns 404 for an unknown trip', async () => {
    const res = await GET(new Request('http://t/'), ctx('nope'));
    expect(res.status).toBe(404);
  });

  it('returns expenses (with linked place name) and targets', async () => {
    addExpense(testHandle.db, {
      tripId: 'trip-1', amount: 1500, category: 'food', spentOn: '2026-06-06', note: 'Ramen', linkedPlaceId: 'p1',
    });
    addExpense(testHandle.db, {
      tripId: 'trip-1', amount: 2000, category: 'lodging', spentOn: '2026-06-05',
    });
    setTarget(testHandle.db, 'trip-1', null, 100000);
    setTarget(testHandle.db, 'trip-1', 'food', 30000);

    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      expenses: Array<{ id: string; amount: number; spentOn: string; placeName: string | null }>;
      targets: Array<{ category: string | null; plannedAmount: number }>;
    };
    // newest spent_on first
    expect(body.expenses.map((e) => e.spentOn)).toEqual(['2026-06-06', '2026-06-05']);
    expect(body.expenses[0]!.placeName).toBe('Ichiran');
    expect(body.expenses[1]!.placeName).toBeNull();
    expect(body.targets).toHaveLength(2);
    expect(body.targets.find((t) => t.category === null)?.plannedAmount).toBe(100000);
  });

  it('returns empty arrays for a trip with no budget data', async () => {
    const res = await GET(new Request('http://t/'), ctx('trip-1'));
    const body = (await res.json()) as { expenses: unknown[]; targets: unknown[] };
    expect(body.expenses).toEqual([]);
    expect(body.targets).toEqual([]);
  });
});
