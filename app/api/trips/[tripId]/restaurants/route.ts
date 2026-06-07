import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listRestaurants } from '@/src/db/repos/restaurants';
import { places, placeDetailsCache, photos as photosTable, type Restaurant } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * RestaurantDTO: all Restaurant fields + scheduledDayDate resolved from the
 * linked place's dayDate, photoPath resolved from place_details_cache via
 * googlePlaceId (the cached Google photo, or null), and personal uploaded
 * photos (owner_type='restaurant', ordered). Photo precedence on the card:
 * first personal photo → cached Google photo → dining glyph.
 */
export interface RestaurantDTO extends Restaurant {
  scheduledDayDate: string | null;
  photoPath: string | null;
  photos: { id: string; width: number | null; height: number | null }[];
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rows = listRestaurants(db, tripId);

  // Batch-resolve dayDate for all linked places in one query (avoids N+1).
  const linkedIds = rows
    .map((r) => r.linkedPlaceId)
    .filter((id): id is string => id !== null);

  const dayMap = new Map<string, string | null>();
  if (linkedIds.length > 0) {
    const placeRows = db
      .select({ id: places.id, dayDate: places.dayDate })
      .from(places)
      .where(inArray(places.id, linkedIds))
      .all();
    for (const p of placeRows) {
      dayMap.set(p.id, p.dayDate ?? null);
    }
  }

  // Batch-resolve the cached Google photo path by googlePlaceId (one query).
  const googleIds = rows
    .map((r) => r.googlePlaceId)
    .filter((id): id is string => id !== null);
  const photoMap = new Map<string, string | null>();
  if (googleIds.length > 0) {
    const cacheRows = db
      .select({
        googlePlaceId: placeDetailsCache.googlePlaceId,
        photoLocalPath: placeDetailsCache.photoLocalPath,
      })
      .from(placeDetailsCache)
      .where(inArray(placeDetailsCache.googlePlaceId, googleIds))
      .all();
    for (const row of cacheRows) {
      photoMap.set(row.googlePlaceId, row.photoLocalPath ?? null);
    }
  }

  // Batch-fetch personal photos (owner_type='restaurant') for all restaurants.
  const photosByOwner = new Map<string, { id: string; width: number | null; height: number | null }[]>();
  const restIds = rows.map((r) => r.id);
  if (restIds.length > 0) {
    const photoRows = db
      .select({
        id: photosTable.id,
        ownerId: photosTable.ownerId,
        width: photosTable.width,
        height: photosTable.height,
        orderIndex: photosTable.orderIndex,
      })
      .from(photosTable)
      .where(and(eq(photosTable.ownerType, 'restaurant'), inArray(photosTable.ownerId, restIds)))
      .orderBy(asc(photosTable.orderIndex))
      .all();
    for (const row of photoRows) {
      const list = photosByOwner.get(row.ownerId) ?? [];
      list.push({ id: row.id, width: row.width, height: row.height });
      photosByOwner.set(row.ownerId, list);
    }
  }

  const restaurantsResult: RestaurantDTO[] = rows.map((r) => ({
    ...r,
    scheduledDayDate: r.linkedPlaceId ? (dayMap.get(r.linkedPlaceId) ?? null) : null,
    photoPath: r.googlePlaceId ? (photoMap.get(r.googlePlaceId) ?? null) : null,
    photos: photosByOwner.get(r.id) ?? [],
  }));

  return NextResponse.json({ restaurants: restaurantsResult });
}
