import { and, asc, desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { restaurants, type Restaurant } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { Restaurant };

type Db = TestDb['db'];

export type RestaurantStatus = Restaurant['status'];

/** One restaurant by id, or undefined. */
export function getRestaurant(db: Db, id: string): Restaurant | undefined {
  return db.select().from(restaurants).where(eq(restaurants.id, id)).get();
}

/** All restaurants for a trip, newest-first (createdAt desc, id tiebreak). */
export function listByTrip(db: Db, tripId: string): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(eq(restaurants.tripId, tripId))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}

/** Restaurants for a trip filtered by status (want-to-try | been), newest-first. */
export function listByStatus(
  db: Db,
  tripId: string,
  status: RestaurantStatus,
): Restaurant[] {
  return db
    .select()
    .from(restaurants)
    .where(and(eq(restaurants.tripId, tripId), eq(restaurants.status, status)))
    .orderBy(desc(restaurants.createdAt), asc(restaurants.id))
    .all();
}

export interface AddRestaurantInput {
  tripId: string;
  name: string;
  cuisine?: string | null;
  rating?: number | null;
  status?: RestaurantStatus; // defaults to 'want-to-try'
  priceLevel?: number | null;
  notes?: string | null;
  linkedPlaceId?: string | null;
}

/** Insert a restaurant; generates id + timestamps. Defaults status 'want-to-try'. */
export function addRestaurant(db: Db, input: AddRestaurantInput): Restaurant {
  const ts = new Date(now());
  const row: Restaurant = {
    id: newId(),
    tripId: input.tripId,
    name: input.name,
    cuisine: input.cuisine ?? null,
    rating: input.rating ?? null,
    status: input.status ?? 'want-to-try',
    priceLevel: input.priceLevel ?? null,
    notes: input.notes ?? null,
    linkedPlaceId: input.linkedPlaceId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(restaurants).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type RestaurantPatch = Partial<
  Pick<
    Restaurant,
    'name' | 'cuisine' | 'rating' | 'status' | 'priceLevel' | 'notes' | 'linkedPlaceId'
  >
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateRestaurant(
  db: Db,
  id: string,
  patch: RestaurantPatch,
): Restaurant | undefined {
  db.update(restaurants)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, id))
    .run();
  return getRestaurant(db, id);
}

/** Delete a restaurant. */
export function deleteRestaurant(db: Db, id: string): void {
  db.delete(restaurants).where(eq(restaurants.id, id)).run();
}

/** Link a restaurant to a scheduled place (sets linked_place_id). */
export function scheduleToDay(
  db: Db,
  id: string,
  placeId: string,
): Restaurant | undefined {
  return updateRestaurant(db, id, { linkedPlaceId: placeId });
}

/** Clear the schedule link (sets linked_place_id NULL). */
export function unschedule(db: Db, id: string): Restaurant | undefined {
  return updateRestaurant(db, id, { linkedPlaceId: null });
}
