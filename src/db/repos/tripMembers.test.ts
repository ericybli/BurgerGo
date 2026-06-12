import { beforeEach, describe, expect, it } from 'vitest';
import { makeTestDb, type TestDb } from '@/src/db/testDb';
import { createTrip } from '@/src/db/repos/trips';
import {
  inviteMember,
  listMembers,
  removeMember,
  isMember,
  tripIdsForUser,
  claimInvites,
  ensureOwner,
} from '@/src/db/repos/tripMembers';

const TRIP = { name: 'Test', startDate: '2026-01-01', endDate: '2026-01-03' };

function addUser(t: TestDb, id: string, email: string) {
  t.sqlite
    .prepare(
      'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, 0, 0)',
    )
    .run(id, email.split('@')[0], email);
}

describe('tripMembers repo', () => {
  let t: TestDb;
  beforeEach(() => {
    t = makeTestDb();
  });

  it('ensureOwner inserts one owner row, idempotently, linking an existing user', () => {
    const trip = createTrip(t.db, TRIP);
    addUser(t, 'u1', 'eric@example.com');
    ensureOwner(t.db, trip.id, 'Eric@Example.com');
    ensureOwner(t.db, trip.id, 'eric@example.com'); // no-op, no throw
    const members = listMembers(t.db, trip.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      role: 'owner',
      invitedEmail: 'eric@example.com',
      userId: 'u1', // linked because the user already existed
    });
  });

  it('invite stores lowercased email, pending until claimed', () => {
    const trip = createTrip(t.db, TRIP);
    inviteMember(t.db, trip.id, 'Friend@GMail.com');
    expect(listMembers(t.db, trip.id)[0]).toMatchObject({
      invitedEmail: 'friend@gmail.com',
      userId: null,
      role: 'member',
    });
    addUser(t, 'u2', 'friend@gmail.com');
    claimInvites(t.db, 'u2', 'friend@gmail.com');
    expect(listMembers(t.db, trip.id)[0]!.userId).toBe('u2');
    expect(isMember(t.db, 'u2', trip.id)).toBe(true);
  });

  it('invite is idempotent per (trip, email)', () => {
    const trip = createTrip(t.db, TRIP);
    inviteMember(t.db, trip.id, 'a@b.c');
    inviteMember(t.db, trip.id, 'a@b.c');
    expect(listMembers(t.db, trip.id)).toHaveLength(1);
  });

  it('tripIdsForUser returns only claimed memberships', () => {
    const t1 = createTrip(t.db, TRIP);
    const t2 = createTrip(t.db, { ...TRIP, name: 'Other' });
    addUser(t, 'u1', 'a@b.c');
    inviteMember(t.db, t1.id, 'a@b.c');
    claimInvites(t.db, 'u1', 'a@b.c');
    inviteMember(t.db, t2.id, 'x@y.z'); // someone else, pending
    expect(tripIdsForUser(t.db, 'u1')).toEqual([t1.id]);
    expect(isMember(t.db, 'u1', t2.id)).toBe(false);
  });

  it('removeMember deletes the row', () => {
    const trip = createTrip(t.db, TRIP);
    inviteMember(t.db, trip.id, 'a@b.c');
    const m = listMembers(t.db, trip.id)[0]!;
    removeMember(t.db, m.id);
    expect(listMembers(t.db, trip.id)).toHaveLength(0);
  });

  it('ensureOwner upgrades existing member row instead of throwing UNIQUE crash', () => {
    const trip = createTrip(t.db, TRIP);
    addUser(t, 'u1', 'x@y.z');
    // invite creates a member row for the normalised email
    inviteMember(t.db, trip.id, 'X@Y.Z');
    // ensureOwner must not throw and must upgrade the row to owner
    expect(() => ensureOwner(t.db, trip.id, 'X@Y.Z')).not.toThrow();
    const members = listMembers(t.db, trip.id);
    expect(members).toHaveLength(1);
    expect(members[0]).toMatchObject({
      role: 'owner',
      invitedEmail: 'x@y.z',
      userId: 'u1',
    });
  });

  it('tripIdsForUser deduplicates when user claimed two invites for the same trip', () => {
    const trip = createTrip(t.db, TRIP);
    addUser(t, 'u1', 'alice@example.com');
    // add two distinct invited-email rows for the same trip
    inviteMember(t.db, trip.id, 'alice@example.com');
    inviteMember(t.db, trip.id, 'alice.alias@example.com');
    // claim both; claimInvites matches by normalised email + null userId
    claimInvites(t.db, 'u1', 'alice@example.com');
    claimInvites(t.db, 'u1', 'alice.alias@example.com');
    const ids = tripIdsForUser(t.db, 'u1');
    expect(ids).toEqual([trip.id]);
  });
});
