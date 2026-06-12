import { describe, expect, it } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import { listMembers } from '@/src/db/repos/tripMembers';
import { seedOwners } from '@/src/db/repos/seedOwners';

describe('seedOwners', () => {
  it('adds an owner row to ownerless trips only, idempotently', () => {
    const t = makeTestDb();
    const a = createTrip(t.db, { name: 'A', startDate: '2026-01-01', endDate: '2026-01-02' });
    const b = createTrip(t.db, { name: 'B', startDate: '2026-01-01', endDate: '2026-01-02' });
    expect(seedOwners(t.db, 'Owner@Mail.com')).toBe(2);
    expect(seedOwners(t.db, 'owner@mail.com')).toBe(0); // second run: nothing to do
    for (const trip of [a, b]) {
      const m = listMembers(t.db, trip.id);
      expect(m).toHaveLength(1);
      expect(m[0]).toMatchObject({ role: 'owner', invitedEmail: 'owner@mail.com' });
    }
  });
});
