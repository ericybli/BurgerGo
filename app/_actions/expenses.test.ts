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

import {
  addExpenseAction,
  updateExpenseAction,
  deleteExpenseAction,
} from '@/app/_actions/expenses';
import { getExpense, listExpensesForTrip } from '@/src/db/repos/expenses';

const TS = new Date('2026-06-08T12:00:00.000Z');

function seed(db: ReturnType<typeof makeTestDb>['db']) {
  db.insert(trips).values({
    id: 'trip-1', name: 'Osaka', startDate: '2026-06-05', endDate: '2026-06-07',
    coverPhoto: null, createdAt: TS, updatedAt: TS,
  }).run();
}

describe('expense actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    seed(testHandle.db);
    revalidatePath.mockClear();
  });

  it('adds an expense and revalidates the budget path', async () => {
    const e = await addExpenseAction({
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: 'Ramen',
    });
    expect(e.amount).toBe(1530);
    expect(getExpense(testHandle.db, e.id)?.category).toBe('food');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('rejects a non-integer or negative amount', async () => {
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: 12.5, category: 'food', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: -1, category: 'food', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
  });

  it('rejects a bad category and a bad date', async () => {
    await expect(
      // @ts-expect-error invalid category
      addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'sightseeing', spentOn: '2026-06-06' }),
    ).rejects.toThrow();
    await expect(
      addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '06/06/2026' }),
    ).rejects.toThrow();
  });

  it('updates an expense and revalidates', async () => {
    const e = await addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    revalidatePath.mockClear();
    const updated = await updateExpenseAction(e.id, { amount: 250, category: 'shopping' });
    expect(updated.amount).toBe(250);
    expect(updated.category).toBe('shopping');
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });

  it('throws when updating a missing expense', async () => {
    await expect(updateExpenseAction('nope', { amount: 1 })).rejects.toThrow('Expense not found');
  });

  it('deletes an expense and revalidates', async () => {
    const e = await addExpenseAction({ tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    revalidatePath.mockClear();
    await deleteExpenseAction(e.id);
    expect(listExpensesForTrip(testHandle.db, 'trip-1')).toHaveLength(0);
    expect(revalidatePath).toHaveBeenCalledWith('/trip/trip-1/budget');
  });
});
