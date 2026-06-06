import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listAllForTrip } from '@/src/db/repos/places';
import { getCachedDetails } from '@/src/db/repos/placeCache';
import { travelLegs, type Place, type TravelLeg } from '@/src/db/schema';

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

  // Build PlaceDTO by joining photoLocalPath from place_details_cache.
  const placesResult: PlaceDTO[] = rawPlaces.map((p) => {
    let photoPath: string | null = null;
    if (p.googlePlaceId) {
      const cacheRow = getCachedDetails(db, p.googlePlaceId);
      photoPath = cacheRow?.photoLocalPath ?? null;
    }
    return { ...p, photoPath };
  });

  const legs: LegDTO[] = db
    .select()
    .from(travelLegs)
    .where(eq(travelLegs.tripId, tripId))
    .all();

  return NextResponse.json({ places: placesResult, legs });
}
