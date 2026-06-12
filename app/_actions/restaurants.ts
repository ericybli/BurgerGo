'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import {
  addRestaurant,
  updateRestaurant,
  deleteRestaurant,
  getRestaurant,
  scheduleRestaurantToDay,
  unscheduleRestaurant,
  type Restaurant,
} from '@/src/db/repos/restaurants';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPoiDetailsRich } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';
import { requireUserAction, requireTripMember } from '@/src/lib/authz';
import type { Place } from '@/src/db/repos/places';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const status = z.enum(['want-to-try', 'been']);
const rating = z.number().int().min(1).max(5);
const priceLevel = z.number().int().min(1).max(4);

function revalidateEats(tripId: string): void {
  revalidatePath(`/trip/${tripId}/eats`);
}

/**
 * Fetch + persist a restaurant's Google place data (star rating, review count,
 * weekday hour lines) and make sure its Google photo is cached for the Eats /
 * map thumbnails. Quiet best-effort: any failure (offline, no key, Google
 * error) returns null and leaves the restaurant untouched. Open-now is NOT
 * persisted — it's volatile; the detail sheet fetches it live when online.
 */
export async function refreshRestaurantGoogleAction(
  restaurantId: string,
): Promise<Restaurant | null> {
  const principal = await requireUserAction();
  const r = getRestaurant(db, restaurantId);
  if (!r?.googlePlaceId || !env.GOOGLE_MAPS_SERVER_KEY) return null;
  requireTripMember(principal, r.tripId);
  try {
    const d = await fetchPoiDetailsRich({
      placeId: r.googlePlaceId,
      apiKey: env.GOOGLE_MAPS_SERVER_KEY,
    });

    // Cache the Google photo once (drives /api/photos/r/[id] thumbnails).
    const cached = getCachedDetails(db, r.googlePlaceId);
    if (!cached?.photoLocalPath && d.photoRefs[0]) {
      const photoLocalPath = await fetchAndStoreGooglePhoto({
        photoRef: d.photoRefs[0],
        googlePlaceId: r.googlePlaceId,
        apiKey: env.GOOGLE_MAPS_SERVER_KEY,
        uploadsDir: env.UPLOADS_DIR,
      });
      upsertDetails(db, {
        googlePlaceId: r.googlePlaceId,
        name: cached?.name ?? d.name,
        address: cached?.address ?? d.address,
        lat: cached?.lat ?? d.lat,
        lng: cached?.lng ?? d.lng,
        categoryGuess: cached?.categoryGuess ?? d.categoryGuess,
        photoRef: d.photoRefs[0],
        photoLocalPath,
        rawJson: cached?.rawJson ?? null,
        fetchedAt: new Date(now()),
      });
    }

    const updated = updateRestaurant(db, restaurantId, {
      googleRating: d.rating,
      googleRatingCount: d.ratingCount,
      googleHours: d.hours.length > 0 ? JSON.stringify(d.hours) : null,
      googleDataUpdatedAt: new Date(now()),
    });
    if (updated) revalidateEats(updated.tripId);
    return updated ?? null;
  } catch {
    return null;
  }
}

// --- addRestaurantAction --------------------------------------------------

const address = z.string().trim().max(500).nullish();
const lat = z.number().min(-90).max(90).nullish();
const lng = z.number().min(-180).max(180).nullish();
const googlePlaceId = z.string().trim().min(1).max(300).nullish();

const addSchema = z.object({
  tripId: z.string().min(1),
  name: z.string().trim().min(1, 'Name is required').max(200),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status,
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
  address,
  lat,
  lng,
  googlePlaceId,
  linkedPlaceId: z.string().min(1).nullish(),
});

export type AddRestaurantActionInput = z.input<typeof addSchema>;

export async function addRestaurantAction(input: AddRestaurantActionInput): Promise<Restaurant> {
  const principal = await requireUserAction();
  const data = addSchema.parse(input);
  requireTripMember(principal, data.tripId);
  const r = addRestaurant(db, {
    tripId: data.tripId,
    name: data.name,
    cuisine: data.cuisine ?? null,
    rating: data.rating ?? null,
    status: data.status,
    priceLevel: data.priceLevel ?? null,
    notes: data.notes ?? null,
    address: data.address ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    googlePlaceId: data.googlePlaceId ?? null,
    linkedPlaceId: data.linkedPlaceId ?? null,
  });
  revalidateEats(data.tripId);
  // Pull Google rating/hours/photo for the new restaurant (best-effort).
  if (r.googlePlaceId) {
    const refreshed = await refreshRestaurantGoogleAction(r.id);
    if (refreshed) return refreshed;
  }
  return r;
}

// --- updateRestaurantAction -----------------------------------------------

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  cuisine: z.string().trim().max(100).nullish(),
  rating: rating.nullish(),
  status: status.optional(),
  priceLevel: priceLevel.nullish(),
  notes: z.string().max(2000).nullish(),
  address,
  lat,
  lng,
  googlePlaceId,
});

export type UpdateRestaurantActionPatch = z.input<typeof updateSchema>;

export async function updateRestaurantAction(
  id: string,
  patch: UpdateRestaurantActionPatch,
): Promise<Restaurant> {
  const principal = await requireUserAction();
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  requireTripMember(principal, existing.tripId);
  const data = updateSchema.parse(patch);
  const updated = updateRestaurant(db, id, data);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  // Refresh Google data when the place id was just set/changed, or has never
  // been fetched for this restaurant (best-effort).
  if (
    updated.googlePlaceId &&
    (updated.googlePlaceId !== existing.googlePlaceId || !updated.googleDataUpdatedAt)
  ) {
    const refreshed = await refreshRestaurantGoogleAction(id);
    if (refreshed) return refreshed;
  }
  return updated;
}

// --- deleteRestaurantAction -----------------------------------------------

export async function deleteRestaurantAction(id: string): Promise<void> {
  const principal = await requireUserAction();
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  requireTripMember(principal, existing.tripId);
  deleteRestaurant(db, id);
  revalidateEats(existing.tripId);
}

// --- scheduleRestaurantToDayAction ----------------------------------------

export async function scheduleRestaurantToDayAction(
  id: string,
  dayDate: string,
): Promise<{ restaurant: Restaurant; place: Place }> {
  const principal = await requireUserAction();
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  requireTripMember(principal, existing.tripId);
  const parsedDay = dateStr.parse(dayDate);
  const result = scheduleRestaurantToDay(db, id, parsedDay);
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return result;
}

// --- unscheduleRestaurantAction -------------------------------------------

export async function unscheduleRestaurantAction(id: string): Promise<Restaurant> {
  const principal = await requireUserAction();
  const existing = getRestaurant(db, id);
  if (!existing) throw new Error('Restaurant not found');
  requireTripMember(principal, existing.tripId);
  const updated = unscheduleRestaurant(db, id);
  if (!updated) throw new Error('Restaurant not found');
  revalidateEats(existing.tripId);
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return updated;
}
