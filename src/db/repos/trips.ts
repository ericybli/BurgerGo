import { eq, inArray } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { trips } from '@/src/db/schema';
import { tripStatus } from '@/src/lib/days';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';
import { tripIdsForUser } from '@/src/db/repos/tripMembers';

export type Trip = typeof trips.$inferSelect;

type Db = TestDb['db'];

export interface TimeCtx {
  tz: string;
}

/** Sort shared by getTrips / getTripsForUser: Active first, then startDate, then id. */
function sortTrips(rows: Trip[], ctx: TimeCtx): Trip[] {
  const status = (t: Trip) =>
    tripStatus({ startDate: t.startDate, endDate: t.endDate }, ctx.tz);
  return rows.slice().sort((a, b) => {
    const aActive = status(a) === 'active' ? 0 : 1;
    const bActive = status(b) === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    if (a.startDate !== b.startDate) return a.startDate < b.startDate ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * All trips, Active-first, then by startDate ascending (stable on id).
 * Active = today ∈ [startDate, endDate] in the given timezone.
 */
export function getTrips(db: Db, ctx: TimeCtx): Trip[] {
  return sortTrips(db.select().from(trips).all(), ctx);
}

/** Trips visible to a user = claimed memberships only, same ordering as getTrips. */
export function getTripsForUser(db: Db, userId: string, ctx: TimeCtx): Trip[] {
  const ids = tripIdsForUser(db, userId);
  if (ids.length === 0) return [];
  const rows = db.select().from(trips).where(inArray(trips.id, ids)).all();
  return sortTrips(rows, ctx);
}

/** One trip by id, or undefined. */
export function getTrip(db: Db, id: string): Trip | undefined {
  return db.select().from(trips).where(eq(trips.id, id)).get();
}

export interface CreateTripInput {
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

/**
 * Validate endDate >= startDate (string compare is safe for YYYY-MM-DD),
 * generate id + timestamps, insert, and return the created row.
 */
export function createTrip(db: Db, input: CreateTripInput): Trip {
  if (input.endDate < input.startDate) {
    throw new Error('End date must be on or after the start date');
  }
  const ts = new Date(now());
  const row: Trip = {
    id: newId(),
    name: input.name,
    startDate: input.startDate,
    endDate: input.endDate,
    coverPhoto: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(trips).values(row).run();
  return row;
}

/** Rename a trip. Returns the updated row, or undefined if not found. */
export function renameTrip(db: Db, id: string, name: string): Trip | undefined {
  db.update(trips)
    .set({ name, updatedAt: new Date(now()) })
    .where(eq(trips.id, id))
    .run();
  return getTrip(db, id);
}

/** Update both trip dates (validated). Returns the updated row, or undefined. */
export function updateTripDates(
  db: Db,
  id: string,
  dates: { startDate: string; endDate: string },
): Trip | undefined {
  if (dates.endDate < dates.startDate) {
    throw new Error('End date must be on or after the start date');
  }
  db.update(trips)
    .set({
      startDate: dates.startDate,
      endDate: dates.endDate,
      updatedAt: new Date(now()),
    })
    .where(eq(trips.id, id))
    .run();
  return getTrip(db, id);
}

/** Set or clear (null) the cover photo path. Returns the updated row. */
export function setCover(
  db: Db,
  id: string,
  path: string | null,
): Trip | undefined {
  db.update(trips)
    .set({ coverPhoto: path, updatedAt: new Date(now()) })
    .where(eq(trips.id, id))
    .run();
  return getTrip(db, id);
}

/** Delete a trip; child rows cascade via FK onDelete. */
export function deleteTrip(db: Db, id: string): void {
  db.delete(trips).where(eq(trips.id, id)).run();
}
