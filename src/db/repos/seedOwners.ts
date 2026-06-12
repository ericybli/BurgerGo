import { and, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { trips, tripMembers } from '@/src/db/schema';
import { ensureOwner } from '@/src/db/repos/tripMembers';

type Db = TestDb['db'];

/** Give every ownerless trip an owner membership for `email`. Returns rows added. */
export function seedOwners(db: Db, email: string): number {
  let added = 0;
  for (const t of db.select({ id: trips.id }).from(trips).all()) {
    const hasOwner = db
      .select({ id: tripMembers.id })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, t.id), eq(tripMembers.role, 'owner')))
      .get();
    if (!hasOwner) {
      ensureOwner(db, t.id, email);
      added += 1;
    }
  }
  return added;
}
