import { NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listAllForTrip } from '@/src/db/repos/places';
import { travelLegs, placeDetailsCache, type Place, type TravelLeg } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * PlaceDTO: all Place fields + photoPath resolved from place_details_cache
 * via googlePlaceId. photoPath is null when there is no cache row.
 */
export interface PlaceDTO extends Place {
  photoPath: string | null;
}

/**
 * LegDTO: all TravelLeg fields (including polyline from the schema).
 */
export type LegDTO = TravelLeg;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rawPlaces = listAllForTrip(db, tripId);

  // Batch-fetch photoLocalPath from place_details_cache for all places in one
  // query instead of one query per place (avoids N+1).
  const googlePlaceIds = rawPlaces
    .map((p) => p.googlePlaceId)
    .filter((id): id is string => id !== null);

  const photoMap = new Map<string, string | null>();
  if (googlePlaceIds.length > 0) {
    const cacheRows = db
      .select({
        googlePlaceId: placeDetailsCache.googlePlaceId,
        photoLocalPath: placeDetailsCache.photoLocalPath,
      })
      .from(placeDetailsCache)
      .where(inArray(placeDetailsCache.googlePlaceId, googlePlaceIds))
      .all();
    for (const row of cacheRows) {
      photoMap.set(row.googlePlaceId, row.photoLocalPath ?? null);
    }
  }

  // Build PlaceDTO using the pre-fetched map.
  const placesResult: PlaceDTO[] = rawPlaces.map((p) => ({
    ...p,
    photoPath: (p.googlePlaceId ? (photoMap.get(p.googlePlaceId) ?? null) : null),
  }));

  const legs: LegDTO[] = db
    .select()
    .from(travelLegs)
    .where(eq(travelLegs.tripId, tripId))
    .all();

  return NextResponse.json({ places: placesResult, legs });
}
