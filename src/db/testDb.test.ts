import { describe, it, expect } from 'vitest';
import { sql } from 'drizzle-orm';
import { makeTestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';

describe('makeTestDb', () => {
  it('returns an in-memory db with migrations applied', () => {
    const { db, sqlite } = makeTestDb();
    // Querying a migrated table must not throw.
    const rows = db.select().from(trips).all();
    expect(rows).toEqual([]);
    const mode = sqlite.pragma('journal_mode', { simple: true });
    // In-memory dbs report 'memory' journal mode.
    expect(String(mode).toLowerCase()).toBe('memory');
  });

  it('isolates state between instances', () => {
    const a = makeTestDb();
    const b = makeTestDb();
    a.sqlite
      .prepare(
        `INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at)
         VALUES ('t1', 'A', '2026-01-01', '2026-01-02', 0, 0)`,
      )
      .run();
    const aCount = a.db.get<{ c: number }>(sql`SELECT count(*) as c FROM trips`);
    const bCount = b.db.get<{ c: number }>(sql`SELECT count(*) as c FROM trips`);
    expect(aCount.c).toBe(1);
    expect(bCount.c).toBe(0);
  });
});
