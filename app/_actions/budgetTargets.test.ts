import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() { return testHandle.db; },
}));

const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { setTargetAction, clearTargetAction } from '@/app/_actions/budgetTargets';
import { listTargetsForTrip } from '@/src/db/repos/budgetTargets';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('budget target actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('sets the overall target (null category) and revalidates', async () => {
    const t = await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(100000);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('sets a per-category target', async () => {
    const t = await setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    expect(t.category).toBe('food');
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(1);
  });

  it('upserts the same (trip, category) in place', async () => {
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 120000 });
    const rows = listTargetsForTrip(testHandle.db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(120000);
  });

  it('rejects a negative or non-integer planned amount', async () => {
    await expect(
      setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: -5 }),
    ).rejects.toThrow();
    await expect(
      setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 1.5 }),
    ).rejects.toThrow();
  });

  it('rejects a bad category', async () => {
    await expect(
      // @ts-expect-error invalid category
      setTargetAction({ tripId: 'trip-1', category: 'sightseeing', plannedAmount: 100 }),
    ).rejects.toThrow();
  });

  it('clears a category target and revalidates', async () => {
    await setTargetAction({ tripId: 'trip-1', category: 'food', plannedAmount: 30000 });
    revalidatePath.mockClear();
    await clearTargetAction('trip-1', 'food');
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('clears the overall target (null category)', async () => {
    await setTargetAction({ tripId: 'trip-1', category: null, plannedAmount: 100000 });
    await clearTargetAction('trip-1', null);
    expect(listTargetsForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
  });
});
