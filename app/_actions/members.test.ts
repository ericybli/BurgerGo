import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeTestDb } from '@/src/db/testDb';

// The action module imports the singleton `db` from this path; we replace it
// with a per-test in-memory db.
const testHandle = { db: makeTestDb().db };
vi.mock('@/src/db/client', () => ({
  get db() {
    return testHandle.db;
  },
}));

// Actions call revalidatePath in places; keep the mock so next/cache is inert.
const revalidatePath = vi.fn();
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => revalidatePath(...args),
}));

import { createTripAction } from '@/app/_actions/trips';
import {
  inviteMemberAction,
  removeMemberAction,
  listMembersAction,
} from '@/app/_actions/members';
import { claimInvites } from '@/src/db/repos/tripMembers';
import { user } from '@/src/db/schema';

function seedUser(id: string, name: string, email: string): void {
  const ts = new Date('2026-06-08T12:00:00.000Z');
  testHandle.db
    .insert(user)
    .values({ id, name, email, emailVerified: true, image: null, createdAt: ts, updatedAt: ts })
    .run();
}

describe('members actions', () => {
  beforeEach(() => {
    testHandle.db = makeTestDb().db;
    revalidatePath.mockClear();
    // createTripAction's ensureOwner links the owner row's userId only when a
    // `user` row for the principal's email exists — seed the mocked test user.
    seedUser('test-user', 'Test', 'test@example.com');
  });

  it('invite adds a pending member and returns the roster', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-01-01', endDate: '2026-01-02' });
    const members = await inviteMemberAction(trip.id, 'Friend@Gmail.com ');
    expect(members.some((m) => m.invitedEmail === 'friend@gmail.com' && m.role === 'member')).toBe(true);
  });

  it('rejects an invalid email', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-01-01', endDate: '2026-01-02' });
    await expect(inviteMemberAction(trip.id, 'not-an-email')).rejects.toThrow();
  });

  it('owner cannot be removed; a member can be', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-01-01', endDate: '2026-01-02' });
    await inviteMemberAction(trip.id, 'x@y.zz'); // zod's .email() needs a 2+ char TLD
    const roster = await listMembersAction(trip.id);
    const owner = roster.find((m) => m.role === 'owner');
    const member = roster.find((m) => m.role === 'member')!;
    expect(owner).toBeDefined();
    await expect(removeMemberAction(trip.id, owner!.id)).rejects.toThrow(/cannot be removed/i);
    await removeMemberAction(trip.id, member.id);
    expect((await listMembersAction(trip.id)).some((m) => m.id === member.id)).toBe(false);
  });

  it('a non-owner member can remove only their own row (leave)', async () => {
    const trip = await createTripAction({ name: 'T', startDate: '2026-01-01', endDate: '2026-01-02' });
    await inviteMemberAction(trip.id, 'a@b.cc');
    await inviteMemberAction(trip.id, 'c@d.ee');
    const roster = await listMembersAction(trip.id);
    const memberA = roster.find((m) => m.invitedEmail === 'a@b.cc')!;
    const memberC = roster.find((m) => m.invitedEmail === 'c@d.ee')!;
    // Register a@b.cc as user 'ua' and claim their pending invites, so the
    // member row's userId is linked (a pending invite alone grants nothing).
    seedUser('ua', 'A', 'a@b.cc');
    claimInvites(testHandle.db, 'ua', 'a@b.cc');
    const { requireUserAction } = await import('@/src/lib/authz');
    // As member 'ua': removing someone else's row must be refused…
    vi.mocked(requireUserAction).mockResolvedValueOnce({
      kind: 'user', userId: 'ua', email: 'a@b.cc', name: 'A', image: null,
    });
    await expect(removeMemberAction(trip.id, memberC.id)).rejects.toThrow(/owner/i);
    // …but removing their own row (= leave) is fine.
    vi.mocked(requireUserAction).mockResolvedValueOnce({
      kind: 'user', userId: 'ua', email: 'a@b.cc', name: 'A', image: null,
    });
    await removeMemberAction(trip.id, memberA.id);
    expect((await listMembersAction(trip.id)).some((m) => m.id === memberA.id)).toBe(false);
  });
});
