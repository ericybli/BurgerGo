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

describe('Plan 3 migration', () => {
  it('creates the two new tables', () => {
    const { sqlite } = makeTestDb();
    const names = tableNames(sqlite);
    expect(names.has('journal_entries')).toBe(true);
    expect(names.has('saved_links')).toBe(true);
  });

  it('creates the Plan 3 indexes', () => {
    const { sqlite } = makeTestDb();
    const names = indexNames(sqlite);
    expect(names.has('idx_journal_trip_created')).toBe(true);
    expect(names.has('idx_links_trip')).toBe(true);
  });

  it('a row in each new table cascades when its trip is deleted', () => {
    const { db, sqlite } = makeTestDb();
    const now = new Date(1_700_000_000_000);
    sqlite
      .prepare(
        'INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at) VALUES (?,?,?,?,?,?)',
      )
      .run('t1', 'T', '2026-01-01', '2026-01-02', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO journal_entries (id, trip_id, title, body, entry_date, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
      )
      .run('j1', 't1', 'Day one', 'hello', '2026-01-01', now.getTime(), now.getTime());
    sqlite
      .prepare(
        'INSERT INTO saved_links (id, trip_id, url, title, note, thumbnail, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
      )
      .run('l1', 't1', 'https://example.com', null, null, null, now.getTime(), now.getTime());

    sqlite.prepare('DELETE FROM trips WHERE id = ?').run('t1');

    for (const tbl of ['journal_entries', 'saved_links']) {
      const { c } = sqlite.prepare(`SELECT count(*) AS c FROM ${tbl}`).get() as {
        c: number;
      };
      expect(c, `${tbl} should cascade-delete`).toBe(0);
    }
    // db is referenced to keep the drizzle instance alive alongside sqlite.
    expect(db).toBeDefined();
  });
});
