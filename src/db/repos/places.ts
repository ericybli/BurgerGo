import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { places, type Place } from '@/src/db/schema';

export type { Place };

type Db = TestDb['db'];

/** All places on one day for a trip, ordered by orderIndex (0-based). */
export function listByDay(db: Db, tripId: string, dayDate: string): Place[] {
  return db
    .select()
    .from(places)
    .where(and(eq(places.tripId, tripId), eq(places.dayDate, dayDate)))
    .orderBy(asc(places.orderIndex))
    .all();
}

/** All Saved (day_date IS NULL) places for a trip, ordered by orderIndex. */
export function listSaved(db: Db, tripId: string): Place[] {
  return db
    .select()
    .from(places)
    .where(and(eq(places.tripId, tripId), isNull(places.dayDate)))
    .orderBy(asc(places.orderIndex))
    .all();
}

/**
 * Every place for a trip, ordered by dayDate ascending with NULL (Saved)
 * last, then orderIndex. The client buckets these by day_date.
 */
export function listAllForTrip(db: Db, tripId: string): Place[] {
  return db
    .select()
    .from(places)
    .where(eq(places.tripId, tripId))
    .orderBy(
      sql`${places.dayDate} IS NULL`,
      asc(places.dayDate),
      asc(places.orderIndex),
    )
    .all();
}
