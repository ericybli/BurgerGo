import { and, asc, desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { restaurants, type Restaurant } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';
import { addPlace, deletePlace, getPlace, type Place } from '@/src/db/repos/places';

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

/** Alias for listByTrip (C2 naming convention). */
export function listRestaurants(db: Db, tripId: string): Restaurant[] {
  return listByTrip(db, tripId);
}

/**
 * Schedule a restaurant onto `dayDate`: create a new category='other' Place
 * (copying name + notes once) and point restaurants.linked_place_id at it.
 * If the restaurant was already scheduled, delete the previous place first so
 * exactly one linked place exists at a time. Returns both rows.
 */
export function scheduleRestaurantToDay(
  db: Db,
  restaurantId: string,
  dayDate: string,
): { restaurant: Restaurant; place: Place } {
  const existing = getRestaurant(db, restaurantId);
  if (!existing) throw new Error('Restaurant not found');

  // Drop any previously-linked place so we never accumulate orphans.
  if (existing.linkedPlaceId) {
    deletePlace(db, existing.linkedPlaceId); // FK set-null clears the link below anyway
  }

  const place = addPlace(db, {
    tripId: existing.tripId,
    dayDate,
    name: existing.name,
    category: 'other',
    notes: existing.notes ?? null,
  });

  db.update(restaurants)
    .set({ linkedPlaceId: place.id, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, restaurantId))
    .run();

  const restaurant = getRestaurant(db, restaurantId)!;
  return { restaurant, place };
}

/**
 * Un-schedule a restaurant: delete its linked place (if any) and clear the
 * link. Returns the updated restaurant, or undefined if not found.
 */
export function unscheduleRestaurant(db: Db, restaurantId: string): Restaurant | undefined {
  const existing = getRestaurant(db, restaurantId);
  if (!existing) return undefined;
  if (existing.linkedPlaceId && getPlace(db, existing.linkedPlaceId)) {
    deletePlace(db, existing.linkedPlaceId);
  }
  db.update(restaurants)
    .set({ linkedPlaceId: null, updatedAt: new Date(now()) })
    .where(eq(restaurants.id, restaurantId))
    .run();
  return getRestaurant(db, restaurantId);
}
