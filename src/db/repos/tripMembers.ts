import { and, eq, isNull } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { tripMembers, user } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

type Db = TestDb['db'];

export type TripMember = typeof tripMembers.$inferSelect;

/** Member row joined with the claimed user's profile (null fields while pending). */
export interface MemberView {
  id: string;
  tripId: string;
  userId: string | null;
  invitedEmail: string;
  role: 'owner' | 'member';
  name: string | null;
  image: string | null;
}

const norm = (email: string) => email.trim().toLowerCase();

function userByEmail(db: Db, email: string) {
  return db.select().from(user).where(eq(user.email, norm(email))).get();
}

/** All members of a trip, owner first, with claimed-user name/image joined in. */
export function listMembers(db: Db, tripId: string): MemberView[] {
  const rows = db
    .select({
      id: tripMembers.id,
      tripId: tripMembers.tripId,
      userId: tripMembers.userId,
      invitedEmail: tripMembers.invitedEmail,
      role: tripMembers.role,
      name: user.name,
      image: user.image,
    })
    .from(tripMembers)
    .leftJoin(user, eq(tripMembers.userId, user.id))
    .where(eq(tripMembers.tripId, tripId))
    .all();
  return rows.sort((a, b) =>
    a.role === b.role ? a.invitedEmail.localeCompare(b.invitedEmail) : a.role === 'owner' ? -1 : 1,
  );
}

/** Insert the owner row for a trip if it has none. Links userId when the email is registered. */
export function ensureOwner(db: Db, tripId: string, email: string): void {
  const existing = db
    .select({ id: tripMembers.id })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.role, 'owner')))
    .get();
  if (existing) return;
  db.insert(tripMembers)
    .values({
      id: newId(),
      tripId,
      userId: userByEmail(db, email)?.id ?? null,
      invitedEmail: norm(email),
      role: 'owner',
      createdAt: new Date(now()),
    })
    .run();
}

/** Invite an email as a member. Idempotent per (trip, email); links userId if registered. */
export function inviteMember(db: Db, tripId: string, email: string): MemberView[] {
  const invitedEmail = norm(email);
  const dup = db
    .select({ id: tripMembers.id })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.invitedEmail, invitedEmail)))
    .get();
  if (!dup) {
    db.insert(tripMembers)
      .values({
        id: newId(),
        tripId,
        userId: userByEmail(db, invitedEmail)?.id ?? null,
        invitedEmail,
        role: 'member',
        createdAt: new Date(now()),
      })
      .run();
  }
  return listMembers(db, tripId);
}

/** One member row by id (for permission checks before removal). */
export function getMember(db: Db, memberId: string): TripMember | undefined {
  return db.select().from(tripMembers).where(eq(tripMembers.id, memberId)).get();
}

export function removeMember(db: Db, memberId: string): void {
  db.delete(tripMembers).where(eq(tripMembers.id, memberId)).run();
}

/** Claimed membership check — pending invites do NOT grant access. */
export function isMember(db: Db, userId: string, tripId: string): boolean {
  return (
    db
      .select({ id: tripMembers.id })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
      .get() !== undefined
  );
}

export function tripIdsForUser(db: Db, userId: string): string[] {
  return db
    .select({ tripId: tripMembers.tripId })
    .from(tripMembers)
    .where(eq(tripMembers.userId, userId))
    .all()
    .map((r) => r.tripId);
}

/** Attach a freshly registered user to every pending invite for their email. */
export function claimInvites(db: Db, userId: string, email: string): void {
  db.update(tripMembers)
    .set({ userId })
    .where(and(eq(tripMembers.invitedEmail, norm(email)), isNull(tripMembers.userId)))
    .run();
}
