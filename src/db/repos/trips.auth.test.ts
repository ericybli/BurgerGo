import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb, type TestDb } from '@/src/db/testDb';
import { createTrip, getTripsForUser } from '@/src/db/repos/trips';
import { inviteMember, claimInvites } from '@/src/db/repos/tripMembers';

describe('getTripsForUser', () => {
  let t: TestDb;
  beforeEach(() => {
    t = makeTestDb();
    t.sqlite
      .prepare(
        "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1','A','a@b.c',1,0,0)",
      )
      .run();
  });

  it('returns only trips the user has claimed membership in', () => {
    const mine = createTrip(t.db, { name: 'Mine', startDate: '2026-01-01', endDate: '2026-01-02' });
    createTrip(t.db, { name: 'Theirs', startDate: '2026-01-01', endDate: '2026-01-02' });
    inviteMember(t.db, mine.id, 'a@b.c');
    claimInvites(t.db, 'u1', 'a@b.c');
    const rows = getTripsForUser(t.db, 'u1', { tz: 'UTC' });
    expect(rows.map((r) => r.name)).toEqual(['Mine']);
  });
});
