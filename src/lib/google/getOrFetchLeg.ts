/**
 * Server entry point for cache-backed Directions (spec §6.3). Used by
 * B1's recomputeDayLegsAction for each consecutive stop pair.
 *
 * Cache hit  → return the stored TravelLeg (no Google call).
 * Cache miss → fetchDirections → upsertLeg (with polyline) → return.
 */
import type { TestDb } from '@/src/db/testDb';
import type { TravelLeg } from '@/src/db/schema';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { getCachedLeg, upsertLeg } from '@/src/db/repos/legs';
import { fetchDirections } from '@/src/lib/google/server';

type Db = TestDb['db'];

interface PlaceRef {
  id: string;
  tripId: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Return the cached leg for (fromPlace, toPlace, mode), or fetch from Google
 * Directions, upsert with polyline, and return the persisted row. Throws if
 * either place lacks coordinates or if Google returns an error.
 */
export async function getOrFetchLeg(
  db: Db,
  fromPlace: PlaceRef,
  toPlace: PlaceRef,
  mode: TravelMode,
  apiKey: string,
): Promise<TravelLeg> {
  const cached = getCachedLeg(db, fromPlace.id, toPlace.id, mode);
  if (cached) return cached;

  if (fromPlace.lat == null || fromPlace.lng == null || toPlace.lat == null || toPlace.lng == null) {
    throw new Error('getOrFetchLeg: both places must have coordinates');
  }

  const result = await fetchDirections({
    origin: { lat: fromPlace.lat, lng: fromPlace.lng },
    destination: { lat: toPlace.lat, lng: toPlace.lng },
    waypoints: [],
    mode,
    apiKey,
  });

  return upsertLeg(db, {
    tripId: fromPlace.tripId,
    fromPlaceId: fromPlace.id,
    toPlaceId: toPlace.id,
    mode,
    durationSeconds: result.durationSeconds,
    distanceMeters: result.distanceMeters,
    polyline: result.polyline,
  });
}
