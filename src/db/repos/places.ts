import { and, asc, eq, isNull, max, sql } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { places, type Place } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

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

/** One place by id, or undefined. */
export function getPlace(db: Db, id: string): Place | undefined {
  return db.select().from(places).where(eq(places.id, id)).get();
}

/** Highest orderIndex in a bucket, or -1 if the bucket is empty. */
function maxOrderIndex(db: Db, tripId: string, dayDate: string | null): number {
  const where =
    dayDate === null
      ? and(eq(places.tripId, tripId), isNull(places.dayDate))
      : and(eq(places.tripId, tripId), eq(places.dayDate, dayDate));
  const row = db
    .select({ m: max(places.orderIndex) })
    .from(places)
    .where(where)
    .get();
  return row?.m ?? -1;
}

export interface AddPlaceInput {
  tripId: string;
  dayDate?: string | null;
  googlePlaceId?: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  category: Place['category'];
  scheduledTime?: string | null;
  durationMin?: number | null;
  cost?: number | null;
  notes?: string | null;
}

/**
 * Insert a place, auto-assigning orderIndex = max(bucket) + 1.
 * Generates id + timestamps.
 */
export function addPlace(db: Db, input: AddPlaceInput): Place {
  const ts = new Date(now());
  const dayDate = input.dayDate ?? null;
  const row: Place = {
    id: newId(),
    tripId: input.tripId,
    dayDate,
    googlePlaceId: input.googlePlaceId ?? null,
    name: input.name,
    address: input.address ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    category: input.category,
    scheduledTime: input.scheduledTime ?? null,
    durationMin: input.durationMin ?? null,
    cost: input.cost ?? null,
    notes: input.notes ?? null,
    aiSummary: null,
    orderIndex: maxOrderIndex(db, input.tripId, dayDate) + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(places).values(row).run();
  return row;
}

/** Editable subset of a place (never id/tripId/orderIndex/timestamps). */
export type PlacePatch = Partial<
  Pick<
    Place,
    | 'googlePlaceId'
    | 'name'
    | 'address'
    | 'lat'
    | 'lng'
    | 'category'
    | 'scheduledTime'
    | 'durationMin'
    | 'cost'
    | 'notes'
    | 'aiSummary'
  >
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updatePlace(db: Db, id: string, patch: PlacePatch): Place | undefined {
  db.update(places)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(places.id, id))
    .run();
  return getPlace(db, id);
}

/** Delete a place; dependent travel_legs cascade via FK onDelete. */
export function deletePlace(db: Db, id: string): void {
  db.delete(places).where(eq(places.id, id)).run();
}

/**
 * Renumber a day's places to match `orderedIds`. Ids not in the target day
 * are ignored; the remaining matched ids become orderIndex 0..n-1.
 * Wrapped in a transaction so a concurrent reader never sees a partially-
 * reordered day.
 */
export function reorderDay(
  db: Db,
  tripId: string,
  dayDate: string,
  orderedIds: string[],
): void {
  db.transaction((tx) => {
    // tx is BetterSQLiteTransaction which shares the same BaseSQLiteDatabase
    // API as Db; the cast is safe because $client is never used inside repos.
    const txDb = tx as unknown as Db;
    const inDay = new Set(listByDay(txDb, tripId, dayDate).map((p) => p.id));
    const ts = new Date(now());
    let i = 0;
    for (const id of orderedIds) {
      if (!inDay.has(id)) continue;
      txDb.update(places)
        .set({ orderIndex: i, updatedAt: ts })
        .where(eq(places.id, id))
        .run();
      i += 1;
    }
  });
}

/**
 * Move a place (Saved or other day) onto `dayDate`, appending at
 * max(day order)+1. Returns the updated row, or undefined if not found.
 */
export function promoteToDay(db: Db, id: string, dayDate: string): Place | undefined {
  const existing = getPlace(db, id);
  if (!existing) return undefined;
  db.update(places)
    .set({
      dayDate,
      orderIndex: maxOrderIndex(db, existing.tripId, dayDate) + 1,
      updatedAt: new Date(now()),
    })
    .where(eq(places.id, id))
    .run();
  return getPlace(db, id);
}

/**
 * Move a place into the Saved bucket (day_date = NULL), appending at the
 * end of Saved. Returns the updated row, or undefined if not found.
 */
export function moveToSaved(db: Db, id: string): Place | undefined {
  const existing = getPlace(db, id);
  if (!existing) return undefined;
  db.update(places)
    .set({
      dayDate: null,
      orderIndex: maxOrderIndex(db, existing.tripId, null) + 1,
      updatedAt: new Date(now()),
    })
    .where(eq(places.id, id))
    .run();
  return getPlace(db, id);
}
