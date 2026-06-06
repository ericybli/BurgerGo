/**
 * C3.2 — exercises the listTargetsForTrip alias and confirms the full
 * upsert/delete contract of the budgetTargets repo.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import {
  listTargetsForTrip,
  setTarget,
  deleteTarget,
} from '@/src/db/repos/budgetTargets';

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

describe('budgetTargets repo (C3.2)', () => {
  let db: Db;
  beforeEach(() => {
    db = makeTestDb().db;
    seedTrip(db);
    seedTrip(db, 'trip-2');
  });

  it('sets an overall target (null category) and reads it back', () => {
    const t = setTarget(db, 'trip-1', null, 100000);
    expect(t.category).toBeNull();
    expect(t.plannedAmount).toBe(100000);
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.category).toBeNull();
  });

  it('sets a per-category target', () => {
    setTarget(db, 'trip-1', 'food', 30000);
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows.find((r) => r.category === 'food')?.plannedAmount).toBe(30000);
  });

  it('upserts: re-setting the overall target updates in place (no duplicate row)', () => {
    setTarget(db, 'trip-1', null, 100000);
    setTarget(db, 'trip-1', null, 120000);
    const rows = listTargetsForTrip(db, 'trip-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(120000);
  });

  it('upserts: re-setting a category target updates in place', () => {
    setTarget(db, 'trip-1', 'food', 30000);
    setTarget(db, 'trip-1', 'food', 45000);
    const rows = listTargetsForTrip(db, 'trip-1').filter((r) => r.category === 'food');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plannedAmount).toBe(45000);
  });

  it('keeps overall + categories as distinct rows and scopes by trip', () => {
    setTarget(db, 'trip-1', null, 100000);
    setTarget(db, 'trip-1', 'food', 30000);
    setTarget(db, 'trip-1', 'lodging', 50000);
    setTarget(db, 'trip-2', null, 999);
    expect(listTargetsForTrip(db, 'trip-1')).toHaveLength(3);
    expect(listTargetsForTrip(db, 'trip-2')).toHaveLength(1);
  });

  it('deletes a category target via deleteTarget', () => {
    setTarget(db, 'trip-1', 'food', 30000);
    deleteTarget(db, 'trip-1', 'food');
    expect(listTargetsForTrip(db, 'trip-1').find((r) => r.category === 'food')).toBeUndefined();
  });

  it('deletes the overall target (null category)', () => {
    setTarget(db, 'trip-1', null, 100000);
    deleteTarget(db, 'trip-1', null);
    expect(listTargetsForTrip(db, 'trip-1')).toHaveLength(0);
  });
});
