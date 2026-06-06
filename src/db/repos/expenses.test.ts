import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { addPlace, deletePlace } from '@/src/db/repos/places';
import {
  addExpense,
  getExpense,
  listByTrip,
  updateExpense,
  deleteExpense,
  totalsByCategory,
  totalsByDay,
  totalForTrip,
} from '@/src/db/repos/expenses';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, tripId: trip.id };
}

describe('expenses repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('addExpense inserts with generated id/timestamps', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 1500,
      category: 'food',
      spentOn: '2026-06-02',
      note: 'lunch',
    });
    expect(e.id).toMatch(/[0-9a-f-]{36}/);
    expect(e.amount).toBe(1500);
    expect(e.category).toBe('food');
    expect(e.spentOn).toBe('2026-06-02');
    expect(e.note).toBe('lunch');
    expect(e.linkedPlaceId).toBeNull();
    expect(e.createdAt).toEqual(NOW);
    expect(getExpense(db, e.id)?.amount).toBe(1500);
  });

  it('listByTrip orders by spent_on desc then createdAt desc', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 200, category: 'food', spentOn: '2026-06-03' });
    addExpense(db, { tripId, amount: 300, category: 'food', spentOn: '2026-06-02' });
    expect(listByTrip(db, tripId).map((e) => e.spentOn)).toEqual([
      '2026-06-03',
      '2026-06-02',
      '2026-06-01',
    ]);
  });

  it('updateExpense patches fields and bumps updatedAt', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
    });
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const updated = updateExpense(db, e.id, { amount: 999, category: 'shopping' });
    expect(updated?.amount).toBe(999);
    expect(updated?.category).toBe('shopping');
    expect(updated?.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
  });

  it('updateExpense returns undefined for unknown id', () => {
    const { db } = setup();
    expect(updateExpense(db, 'nope', { amount: 1 })).toBeUndefined();
  });

  it('deleteExpense removes the row', () => {
    const { db, tripId } = setup();
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
    });
    deleteExpense(db, e.id);
    expect(getExpense(db, e.id)).toBeUndefined();
  });

  it('totalsByCategory sums per category (only categories present)', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 1000, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 500, category: 'food', spentOn: '2026-06-02' });
    addExpense(db, { tripId, amount: 2000, category: 'lodging', spentOn: '2026-06-01' });
    const totals = totalsByCategory(db, tripId);
    expect(totals).toEqual([
      { category: 'food', total: 1500 },
      { category: 'lodging', total: 2000 },
    ]);
  });

  it('totalsByDay sums per spent_on date, descending', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 200, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 50, category: 'transport', spentOn: '2026-06-03' });
    const totals = totalsByDay(db, tripId);
    expect(totals).toEqual([
      { spentOn: '2026-06-03', total: 50 },
      { spentOn: '2026-06-01', total: 300 },
    ]);
  });

  it('totalForTrip sums every expense', () => {
    const { db, tripId } = setup();
    addExpense(db, { tripId, amount: 100, category: 'food', spentOn: '2026-06-01' });
    addExpense(db, { tripId, amount: 250, category: 'lodging', spentOn: '2026-06-02' });
    expect(totalForTrip(db, tripId)).toBe(350);
    // Empty trip totals to 0.
    const other = createTrip(db, { name: 'X', startDate: '2026-07-01', endDate: '2026-07-02' });
    expect(totalForTrip(db, other.id)).toBe(0);
  });

  it('deleting a linked place sets linked_place_id NULL (FK set null)', () => {
    const { db, tripId } = setup();
    const place = addPlace(db, {
      tripId,
      name: 'P',
      category: 'other',
      dayDate: '2026-06-02',
    });
    const e = addExpense(db, {
      tripId,
      amount: 100,
      category: 'food',
      spentOn: '2026-06-02',
      linkedPlaceId: place.id,
    });
    deletePlace(db, place.id);
    expect(getExpense(db, e.id)?.linkedPlaceId).toBeNull();
  });
});
