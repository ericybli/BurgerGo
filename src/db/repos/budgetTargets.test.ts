import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import {
  setTarget,
  getTarget,
  getOverallTarget,
  listTargets,
  deleteTarget,
} from '@/src/db/repos/budgetTargets';

const NOW = new Date('2026-06-08T12:00:00.000Z');

function setup() {
  const { db, sqlite } = makeTestDb();
  const trip = createTrip(db, {
    name: 'Tokyo',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  return { db, sqlite, tripId: trip.id };
}

describe('budgetTargets repo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('setTarget inserts an overall target (category null)', () => {
    const { db, tripId } = setup();
    const t = setTarget(db, tripId, null, 500000);
    expect(t.id).toMatch(/[0-9a-f-]{36}/);
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(500000);
    expect(t.createdAt).toEqual(NOW);
    expect(getOverallTarget(db, tripId)?.plannedAmount).toBe(500000);
  });

  it('setTarget inserts a per-category target', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'food', 80000);
    expect(getTarget(db, tripId, 'food')?.plannedAmount).toBe(80000);
    expect(getTarget(db, tripId, 'lodging')).toBeUndefined();
  });

  it('setTarget upserts the overall row in place (no duplicate)', () => {
    const { db, sqlite, tripId } = setup();
    const first = setTarget(db, tripId, null, 100000);
    vi.setSystemTime(new Date('2026-06-09T12:00:00Z'));
    const second = setTarget(db, tripId, null, 250000);
    expect(second.id).toBe(first.id); // same row, updated
    expect(second.plannedAmount).toBe(250000);
    expect(second.createdAt).toEqual(NOW); // createdAt preserved
    expect(second.updatedAt).toEqual(new Date('2026-06-09T12:00:00Z'));
    const { c } = sqlite
      .prepare('SELECT count(*) AS c FROM budget_targets')
      .get() as { c: number };
    expect(c).toBe(1);
  });

  it('setTarget upserts a per-category row in place (no duplicate)', () => {
    const { db, sqlite, tripId } = setup();
    const first = setTarget(db, tripId, 'food', 50000);
    const second = setTarget(db, tripId, 'food', 60000);
    expect(second.id).toBe(first.id);
    expect(second.plannedAmount).toBe(60000);
    const { c } = sqlite
      .prepare("SELECT count(*) AS c FROM budget_targets WHERE category = 'food'")
      .get() as { c: number };
    expect(c).toBe(1);
  });

  it('overall and per-category targets coexist independently', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, null, 500000);
    setTarget(db, tripId, 'food', 80000);
    setTarget(db, tripId, 'lodging', 120000);
    expect(getOverallTarget(db, tripId)?.plannedAmount).toBe(500000);
    expect(getTarget(db, tripId, 'food')?.plannedAmount).toBe(80000);
    expect(listTargets(db, tripId)).toHaveLength(3);
  });

  it('listTargets returns overall first, then categories alphabetically', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'lodging', 1);
    setTarget(db, tripId, null, 2);
    setTarget(db, tripId, 'food', 3);
    expect(listTargets(db, tripId).map((t) => t.category)).toEqual([
      null,
      'food',
      'lodging',
    ]);
  });

  it('deleteTarget removes the overall row', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, null, 100);
    deleteTarget(db, tripId, null);
    expect(getOverallTarget(db, tripId)).toBeUndefined();
  });

  it('deleteTarget removes a per-category row', () => {
    const { db, tripId } = setup();
    setTarget(db, tripId, 'food', 100);
    deleteTarget(db, tripId, 'food');
    expect(getTarget(db, tripId, 'food')).toBeUndefined();
  });
});
