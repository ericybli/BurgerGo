import { describe, expect, it } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';

describe('auth schema shape', () => {
  it('creates user/session/account/verification/trip_members tables', () => {
    const { sqlite } = makeTestDb();
    const names = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);
    for (const t of ['user', 'session', 'account', 'verification', 'trip_members']) {
      expect(names).toContain(t);
    }
  });

  it('trip_members enforces unique (trip_id, invited_email)', () => {
    const { sqlite } = makeTestDb();
    sqlite
      .prepare(
        "INSERT INTO trips (id, name, start_date, end_date, created_at, updated_at) VALUES ('t1','x','2026-01-01','2026-01-02',0,0)",
      )
      .run();
    const ins = sqlite.prepare(
      "INSERT INTO trip_members (id, trip_id, invited_email, role, created_at) VALUES (?, 't1', 'a@b.c', 'member', 0)",
    );
    ins.run('m1');
    expect(() => ins.run('m2')).toThrow(/UNIQUE/);
  });
});
