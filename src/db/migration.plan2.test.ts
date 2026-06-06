import { describe, it, expect } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';

/** Names of every table in the migrated in-memory DB. */
function tableNames(sqlite: ReturnType<typeof makeTestDb>['sqlite']): Set<string> {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

/** Names of every index in the migrated in-memory DB. */
function indexNames(sqlite: ReturnType<typeof makeTestDb>['sqlite']): Set<string> {
  const rows = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
    .all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

describe('Plan 2 migration', () => {
  it('creates the four new tables', () => {
    const { sqlite } = makeTestDb();
    const names = tableNames(sqlite);
    expect(names.has('restaurants')).toBe(true);
    expect(names.has('expenses')).toBe(true);
    expect(names.has('budget_targets')).toBe(true);
    expect(names.has('photos')).toBe(true);
  });

  it('creates the Plan 2 indexes', () => {
    const { sqlite } = makeTestDb();
    const names = indexNames(sqlite);
    expect(names.has('idx_restaurants_trip')).toBe(true);
    expect(names.has('idx_expenses_trip_date')).toBe(true);
    expect(names.has('idx_expenses_trip_cat')).toBe(true);
    expect(names.has('uniq_budget_targets_trip_cat')).toBe(true);
    expect(names.has('idx_photos_owner')).toBe(true);
  });

  it('a row in each new table cascades when its trip is deleted', () => {
    const { db, sqlite } = makeTestDb();
    // Foreign keys are ON in makeTestDb; insert a trip + one child per table.
    const now = new Date(1_700_000_000_000);
    sqlite
      .prepare(
        'INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('t1', 'T', '2026-01-01', '2026-01-02', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO restaurants (id, trip_id, name, status, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('r1', 't1', 'Soba', 'want-to-try', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO expenses (id, trip_id, amount, category, spent_on, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('e1', 't1', 1200, 'food', '2026-01-01', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO budget_targets (id, trip_id, category, planned_amount, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('b1', 't1', null, 50000, now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO photos (id, trip_id, owner_type, owner_id, path, order_index, created_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('p1', 't1', 'place', 'pl1', 't1/p1', 0, now.getTime());

    sqlite.prepare('DELETE FROM trips WHERE id = ?').run('t1');

    for (const tbl of ['restaurants', 'expenses', 'budget_targets', 'photos']) {
      const { c } = sqlite.prepare(`SELECT count(*) AS c FROM ${tbl}`).get() as {
        c: number;
      };
      expect(c, `${tbl} should cascade-delete`).toBe(0);
    }
    // db is referenced to keep the drizzle instance alive alongside sqlite.
    expect(db).toBeDefined();
  });
});
