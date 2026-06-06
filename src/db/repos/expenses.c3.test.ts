/**
 * C3.1 — exercises the listExpensesForTrip alias and confirms the existing
 * expenses repo satisfies the C3 contract (no-leak, FK set-null, etc.).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { eq } from 'drizzle-orm';
import { trips, places } from '@/src/db/schema';
import {
  listExpensesForTrip,
  getExpense,
  addExpense,
  updateExpense,
  deleteExpense,
} from '@/src/db/repos/expenses';

vi.mock('@/src/lib/clock', () => ({ now: () => 1_700_000_000_000 }));

const TS = new Date(1_700_000_000_000);
type Db = ReturnType<typeof makeTestDb>['db'];

function seedTrip(db: Db, id = 'trip-1') {
  db.insert(trips)
    .values({
      id,
      name: 'Osaka',
      startDate: '2026-06-05',
      endDate: '2026-06-07',
      coverPhoto: null,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

function seedPlace(db: Db, id: string, tripId = 'trip-1') {
  db.insert(places)
    .values({
      id,
      tripId,
      dayDate: null,
      googlePlaceId: null,
      name: 'Place',
      address: null,
      lat: null,
      lng: null,
      category: 'sightseeing',
      scheduledTime: null,
      durationMin: null,
      cost: null,
      notes: null,
      orderIndex: 0,
      createdAt: TS,
      updatedAt: TS,
    })
    .run();
}

describe('expenses repo (C3.1)', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedTrip(db, 'trip-2');
  });

  it('adds an expense with generated id + timestamps and reads it back', () => {
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 1530,
      category: 'food',
      spentOn: '2026-06-06',
      note: 'Ramen',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.amount).toBe(1530);
    expect(e.category).toBe('food');
    expect(e.spentOn).toBe('2026-06-06');
    expect(e.linkedPlaceId).toBeNull();
    expect(e.createdAt).toEqual(TS);
    expect(getExpense(db, e.id)?.note).toBe('Ramen');
  });

  it('stores an optional linked place id', () => {
    seedPlace(db, 'p1');
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 800,
      category: 'transport',
      spentOn: '2026-06-05',
      linkedPlaceId: 'p1',
    });
    expect(getExpense(db, e.id)?.linkedPlaceId).toBe('p1');
  });

  it("lists a trip's expenses newest spent_on first, never leaking other trips", () => {
    addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    addExpense(db, { tripId: 'trip-1', amount: 200, category: 'food', spentOn: '2026-06-07' });
    addExpense(db, { tripId: 'trip-2', amount: 999, category: 'food', spentOn: '2026-06-06' });
    const rows = listExpensesForTrip(db, 'trip-1');
    expect(rows.map((r) => r.amount)).toEqual([200, 100]);
  });

  it('patches an expense and bumps updatedAt; returns the row', () => {
    const e = addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    const updated = updateExpense(db, e.id, { amount: 250, category: 'shopping', note: 'Souvenir' });
    expect(updated?.amount).toBe(250);
    expect(updated?.category).toBe('shopping');
    expect(updated?.note).toBe('Souvenir');
  });

  it('deletes an expense', () => {
    const e = addExpense(db, { tripId: 'trip-1', amount: 100, category: 'food', spentOn: '2026-06-05' });
    deleteExpense(db, e.id);
    expect(getExpense(db, e.id)).toBeUndefined();
  });

  it('clears a linked place to NULL when the place is deleted (FK set null)', () => {
    seedPlace(db, 'p1');
    const e = addExpense(db, {
      tripId: 'trip-1',
      amount: 800,
      category: 'transport',
      spentOn: '2026-06-05',
      linkedPlaceId: 'p1',
    });
    db.delete(places).where(eq(places.id, 'p1')).run();
    expect(getExpense(db, e.id)?.linkedPlaceId).toBeNull();
  });
});
