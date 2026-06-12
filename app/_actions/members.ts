'use server';

import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import {
  listMembers,
  inviteMember,
  getMember,
  removeMember,
  type MemberView,
} from '@/src/db/repos/tripMembers';
import { requireUserAction, requireTripMember, type Principal } from '@/src/lib/authz';

async function guard(tripId: string): Promise<Principal> {
  const principal = await requireUserAction();
  if (!getTrip(db, tripId)) throw new Error('Trip not found');
  requireTripMember(principal, tripId);
  return principal;
}

/** Roster of a trip (pending invites included). Any member may look. */
export async function listMembersAction(tripId: string): Promise<MemberView[]> {
  await guard(z.string().min(1).parse(tripId));
  return listMembers(db, tripId);
}

/** Invite an email (any member may invite). Idempotent. Returns the roster. */
export async function inviteMemberAction(tripId: string, email: string): Promise<MemberView[]> {
  const data = z
    .object({ tripId: z.string().min(1), email: z.string().trim().toLowerCase().email() })
    .parse({ tripId, email });
  await guard(data.tripId);
  return inviteMember(db, data.tripId, data.email);
}

/**
 * Remove a member row. Rules: the owner row is immovable (delete the trip
 * instead); the owner may remove anyone else; a member may remove only their
 * own row (= leave). Machine principals may remove any non-owner row.
 */
export async function removeMemberAction(tripId: string, memberId: string): Promise<MemberView[]> {
  const data = z
    .object({ tripId: z.string().min(1), memberId: z.string().min(1) })
    .parse({ tripId, memberId });
  const principal = await guard(data.tripId);
  const target = getMember(db, data.memberId);
  if (!target || target.tripId !== data.tripId) throw new Error('Member not found');
  if (target.role === 'owner') throw new Error('The owner cannot be removed');
  if (principal.kind === 'user') {
    const mine = listMembers(db, data.tripId).find((m) => m.userId === principal.userId);
    const isOwner = mine?.role === 'owner';
    const isSelf = target.userId === principal.userId;
    if (!isOwner && !isSelf) throw new Error('Only the owner can remove other members');
  }
  removeMember(db, data.memberId);
  return listMembers(db, data.tripId);
}
