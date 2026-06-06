/**
 * Travel-legs repo (spec §6.3 / §9.2). B0 creates the two cache primitives;
 * B1 EXTENDS THIS SAME FILE with legsForDay + invalidateLegsTouchingPlace.
 *
 * TravelMode is imported from @/src/lib/googleMapsUrl — never redefined here.
 */
import { and, eq, or } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { travelLegs, type TravelLeg } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { listByDay } from '@/src/db/repos/places';

export type { TravelLeg };

type Db = TestDb['db'];

/**
 * Read the cached leg for an exact (from, to, mode) triple, or undefined.
 * Matches the `uniq_leg` composite unique index in the schema.
 */
export function getCachedLeg(
  db: Db,
  fromPlaceId: string,
  toPlaceId: string,
  mode: TravelMode,
): TravelLeg | undefined {
  return db
    .select()
    .from(travelLegs)
    .where(
      and(
        eq(travelLegs.fromPlaceId, fromPlaceId),
        eq(travelLegs.toPlaceId, toPlaceId),
        eq(travelLegs.mode, mode),
      ),
    )
    .get();
}

export interface UpsertLegInput {
  tripId: string;
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  /** Overview polyline from Google Directions; null when not yet fetched. */
  polyline: string | null;
}

/**
 * Insert or refresh the cached leg for (from, to, mode). On conflict against
 * the `uniq_leg` index the duration/distance/polyline/computedAt are
 * overwritten; the row id is preserved. `tripId` is also kept in the
 * conflict-set so a trip reassignment is always reflected. Returns the row.
 */
export function upsertLeg(db: Db, input: UpsertLegInput): TravelLeg {
  const computedAt = new Date(now());
  db.insert(travelLegs)
    .values({
      id: newId(),
      tripId: input.tripId,
      fromPlaceId: input.fromPlaceId,
      toPlaceId: input.toPlaceId,
      mode: input.mode,
      durationSeconds: input.durationSeconds,
      distanceMeters: input.distanceMeters,
      polyline: input.polyline,
      computedAt,
    })
    .onConflictDoUpdate({
      target: [travelLegs.fromPlaceId, travelLegs.toPlaceId, travelLegs.mode],
      set: {
        tripId: input.tripId,
        durationSeconds: input.durationSeconds,
        distanceMeters: input.distanceMeters,
        polyline: input.polyline,
        computedAt,
      },
    })
    .run();
  return getCachedLeg(db, input.fromPlaceId, input.toPlaceId, input.mode) as TravelLeg;
}

/**
 * Cached legs for a day in one travel mode, in itinerary order: one entry
 * per consecutive place pair (place[i] → place[i+1]). A pair with no cached
 * leg yields `null` so the caller knows which legs need recomputing.
 */
export function legsForDay(
  db: Db,
  tripId: string,
  dayDate: string,
  mode: TravelMode,
): Array<TravelLeg | null> {
  const ordered = listByDay(db, tripId, dayDate);
  const out: Array<TravelLeg | null> = [];
  for (let i = 0; i < ordered.length - 1; i += 1) {
    out.push(
      getCachedLeg(db, ordered[i]!.id, ordered[i + 1]!.id, mode) ?? null,
    );
  }
  return out;
}

/**
 * Delete every cached leg referencing `placeId` as its from- OR to-end
 * (all modes). Called after coords change or place is removed from a day.
 * Returns the count of legs deleted.
 */
export function invalidateLegsTouchingPlace(db: Db, placeId: string): number {
  const res = db
    .delete(travelLegs)
    .where(
      or(
        eq(travelLegs.fromPlaceId, placeId),
        eq(travelLegs.toPlaceId, placeId),
      ),
    )
    .run();
  return res.changes;
}
