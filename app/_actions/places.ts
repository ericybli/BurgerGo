'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/src/db/client';
import {
  addPlace,
  updatePlace,
  deletePlace,
  reorderDay,
  promoteToDay,
  moveToSaved,
  listByDay,
  getPlace,
  type Place,
} from '@/src/db/repos/places';
import { invalidateLegsTouchingPlace } from '@/src/db/repos/legs';
import { setDayMode } from '@/src/db/repos/dayModes';
import { getTrip } from '@/src/db/repos/trips';
import { getSettings } from '@/src/db/repos/settings';
import { env } from '@/src/env';
import { getOrFetchLeg } from '@/src/lib/google/getOrFetchLeg';
import { generatePlaceSummary } from '@/src/lib/openai/server';
import type { TravelLeg, DayMode } from '@/src/db/schema';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM');
const travelMode = z.enum(['walk', 'drive', 'transit']);
const category = z.enum([
  'sightseeing', 'lodging', 'hotel', 'airbnb', 'airport', 'transport',
  'activity', 'shopping', 'parking', 'entrance', 'museum', 'event', 'other',
]);

function revalidatePlan(tripId: string): void {
  revalidatePath(`/trip/${tripId}/plan`);
}

// --- addPlaceAction -------------------------------------------------------

const addSchema = z.object({
  tripId: z.string().min(1),
  dayDate: dateStr.nullish(),
  googlePlaceId: z.string().min(1).nullish(),
  name: z.string().trim().min(1, 'Name is required').max(200),
  address: z.string().max(500).nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  category,
  scheduledTime: timeStr.nullish(),
  durationMin: z.number().int().nonnegative().nullish(),
  cost: z.number().int().nullish(),
  notes: z.string().max(2000).nullish(),
});

export type AddPlaceActionInput = z.input<typeof addSchema>;

export async function addPlaceAction(input: AddPlaceActionInput): Promise<Place> {
  const data = addSchema.parse(input);
  const place = addPlace(db, {
    tripId: data.tripId,
    dayDate: data.dayDate ?? null,
    googlePlaceId: data.googlePlaceId ?? null,
    name: data.name,
    address: data.address ?? null,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    category: data.category,
    scheduledTime: data.scheduledTime ?? null,
    durationMin: data.durationMin ?? null,
    cost: data.cost ?? null,
    notes: data.notes ?? null,
  });
  revalidatePlan(data.tripId);
  return place;
}

// --- updatePlaceAction ----------------------------------------------------

const updateSchema = z.object({
  googlePlaceId: z.string().min(1).nullish(),
  name: z.string().trim().min(1).max(200).optional(),
  address: z.string().max(500).nullish(),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  category: category.optional(),
  scheduledTime: timeStr.nullish(),
  durationMin: z.number().int().nonnegative().nullish(),
  cost: z.number().int().nullish(),
  notes: z.string().max(2000).nullish(),
  aiSummary: z.string().max(4000).nullish(),
});

export type UpdatePlaceActionPatch = z.input<typeof updateSchema>;

export async function updatePlaceAction(
  id: string,
  patch: UpdatePlaceActionPatch,
): Promise<Place> {
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  const data = updateSchema.parse(patch);
  const coordsTouched =
    Object.prototype.hasOwnProperty.call(patch, 'lat') ||
    Object.prototype.hasOwnProperty.call(patch, 'lng');
  const updated = updatePlace(db, id, data);
  if (!updated) throw new Error('Place not found');
  if (coordsTouched) {
    invalidateLegsTouchingPlace(db, id);
  }
  revalidatePlan(existing.tripId);
  return updated;
}

// --- deletePlaceAction ----------------------------------------------------

export async function deletePlaceAction(id: string): Promise<void> {
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  invalidateLegsTouchingPlace(db, id);
  deletePlace(db, id);
  revalidatePlan(existing.tripId);
}

// --- reorderDayAction -----------------------------------------------------

export async function reorderDayAction(
  tripId: string,
  dayDate: string,
  ids: string[],
): Promise<void> {
  const parsedTrip = z.string().min(1).parse(tripId);
  const parsedDay = dateStr.parse(dayDate);
  const parsedIds = z.array(z.string().min(1)).parse(ids);
  // Reordering changes adjacency ⇒ every leg touching a place in this day is stale.
  for (const place of listByDay(db, parsedTrip, parsedDay)) {
    invalidateLegsTouchingPlace(db, place.id);
  }
  reorderDay(db, parsedTrip, parsedDay, parsedIds);
  revalidatePlan(parsedTrip);
}

// --- promoteToDayAction ---------------------------------------------------

export async function promoteToDayAction(id: string, dayDate: string): Promise<Place> {
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  const parsedDay = dateStr.parse(dayDate);
  invalidateLegsTouchingPlace(db, id);
  const updated = promoteToDay(db, id, parsedDay);
  if (!updated) throw new Error('Place not found');
  revalidatePlan(existing.tripId);
  return updated;
}

// --- copyPlaceToDayAction -------------------------------------------------

/**
 * Duplicate a place onto another day (e.g. revisiting the same spot). Copies the
 * core fields + notes/cost/time/AI summary into a NEW place on `dayDate`; the
 * original is left untouched. Personal photos and attached links stay with the
 * original (not duplicated). Returns the new place.
 */
export async function copyPlaceToDayAction(id: string, dayDate: string): Promise<Place> {
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  const parsedDay = dateStr.parse(dayDate);
  const copy = addPlace(db, {
    tripId: existing.tripId,
    dayDate: parsedDay,
    googlePlaceId: existing.googlePlaceId,
    name: existing.name,
    address: existing.address,
    lat: existing.lat,
    lng: existing.lng,
    category: existing.category,
    scheduledTime: existing.scheduledTime,
    durationMin: existing.durationMin,
    cost: existing.cost,
    notes: existing.notes,
  });
  if (existing.aiSummary) updatePlace(db, copy.id, { aiSummary: existing.aiSummary });
  revalidatePlan(existing.tripId);
  return copy;
}

// --- moveToSavedAction ----------------------------------------------------

export async function moveToSavedAction(id: string): Promise<Place> {
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  invalidateLegsTouchingPlace(db, id);
  const updated = moveToSaved(db, id);
  if (!updated) throw new Error('Place not found');
  revalidatePlan(existing.tripId);
  return updated;
}

// --- generatePlaceSummaryAction -------------------------------------------

export async function generatePlaceSummaryAction(placeId: string): Promise<Place | null> {
  const id = z.string().min(1).parse(placeId);
  const place = getPlace(db, id);
  if (!place) throw new Error('Place not found');
  const trip = getTrip(db, place.tripId);
  if (!trip) throw new Error('Trip not found');

  const cfg = getSettings(db);
  const summary = await generatePlaceSummary({
    name: place.name,
    address: place.address,
    category: place.category,
    tripName: trip.name,
    startDate: trip.startDate,
    endDate: trip.endDate,
    prompt: cfg?.aiPrompt ?? null,
    model: cfg?.aiModel ?? null,
  });
  if (!summary) return null; // no key / failure → leave existing summary untouched

  const updated = updatePlace(db, id, { aiSummary: summary });
  revalidatePlan(place.tripId);
  return updated ?? null;
}

// --- recomputeDayLegsAction -----------------------------------------------

/**
 * Recompute all legs for a day in one travel mode (online path only).
 * For each consecutive stop pair: cache hit → reuse; miss → Google Directions
 * → upsertLeg with polyline. Returns the resulting legs.
 * Called by PlanClient (B2) after add/reorder/delete/promote/mode-change.
 */
export async function recomputeDayLegsAction(
  tripId: string,
  dayDate: string,
  defaultMode: TravelMode,
): Promise<TravelLeg[]> {
  const parsedTrip = z.string().min(1).parse(tripId);
  const parsedDay = dateStr.parse(dayDate);
  const ordered = listByDay(db, parsedTrip, parsedDay);
  if (ordered.length < 2) return [];
  if (!env.GOOGLE_MAPS_SERVER_KEY) return [];

  const key = env.GOOGLE_MAPS_SERVER_KEY;
  // Build the routable consecutive pairs (skip any missing coords), then fetch
  // them concurrently: the per-pair Google Directions round-trips are independent,
  // so awaiting them in parallel collapses N-1 sequential calls into one wave.
  // better-sqlite3 is synchronous, so each leg's cache read/upsert still runs
  // serialized on the JS thread — only the network waits overlap. Promise.all
  // preserves order; a failed pair resolves to null and is dropped.
  const pairs = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    const from = ordered[i]!;
    const to = ordered[i + 1]!;
    if (from.lat == null || from.lng == null || to.lat == null || to.lng == null) {
      continue; // skip pairs missing coords
    }
    // Each leg uses its own mode (stored on the destination place); legs that
    // were never customized follow the day default.
    pairs.push({ from, to, legMode: to.legMode ?? defaultMode });
  }
  const results = await Promise.all(
    pairs.map(async ({ from, to, legMode }) => {
      try {
        return await getOrFetchLeg(
          db,
          { id: from.id, tripId: from.tripId, lat: from.lat!, lng: from.lng! },
          { id: to.id, tripId: to.tripId, lat: to.lat!, lng: to.lng! },
          legMode,
          key,
        );
      } catch (err) {
        // Log and continue — a single failed pair should not block the rest.
        console.error('[recomputeDayLegsAction] leg fetch failed', err);
        return null;
      }
    }),
  );
  return results.filter((leg): leg is TravelLeg => leg !== null);
}

// --- setLegModeAction -----------------------------------------------------

/**
 * Set the travel mode of the leg ARRIVING at `placeId` (from the previous stop).
 * Persists it on the place; the caller then triggers a day recompute (which uses
 * each leg's own mode). `null` clears the override → the leg follows the day
 * default again.
 */
export async function setLegModeAction(
  placeId: string,
  mode: TravelMode | null,
): Promise<Place> {
  const id = z.string().min(1).parse(placeId);
  const parsedMode = mode === null ? null : travelMode.parse(mode);
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  const updated = updatePlace(db, id, { legMode: parsedMode });
  if (!updated) throw new Error('Place not found');
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return updated;
}

// --- setDayModeAction -----------------------------------------------------

/**
 * Persist a day's default travel mode (keyed by trip + day). The caller then
 * triggers a day recompute with the new mode, which re-applies it to every leg
 * that has no per-leg `legMode` override. Online-only, like all writes.
 */
export async function setDayModeAction(
  tripId: string,
  dayDate: string,
  mode: TravelMode,
): Promise<DayMode> {
  const parsedTrip = z.string().min(1).parse(tripId);
  const parsedDay = dateStr.parse(dayDate);
  const parsedMode = travelMode.parse(mode);
  const trip = getTrip(db, parsedTrip);
  if (!trip) throw new Error('Trip not found');
  const row = setDayMode(db, parsedTrip, parsedDay, parsedMode);
  revalidatePath(`/trip/${parsedTrip}/plan`);
  return row;
}

// --- setPlaceListAction ---------------------------------------------------

/**
 * Move a saved place into a list (`listId`) or out of any list (`null` →
 * "loose"). Only meaningful for Saved-bucket places. Online-only.
 */
export async function setPlaceListAction(placeId: string, listId: string | null): Promise<Place> {
  const id = z.string().min(1).parse(placeId);
  const parsedListId = listId === null ? null : z.string().min(1).parse(listId);
  const existing = getPlace(db, id);
  if (!existing) throw new Error('Place not found');
  const updated = updatePlace(db, id, { listId: parsedListId });
  if (!updated) throw new Error('Place not found');
  revalidatePath(`/trip/${existing.tripId}/plan`);
  return updated;
}
