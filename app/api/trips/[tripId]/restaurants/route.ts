import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { listRestaurants, addRestaurant } from '@/src/db/repos/restaurants';
import { fetchForwardGeocode } from '@/src/lib/google/server';
import { isWriteAuthorized } from '@/src/lib/apiKey';
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

const createRestaurantSchema = z.object({
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).optional(),
  about: z.string().max(2000).optional(), // folded into notes (restaurants have no separate field)
  notes: z.string().max(2000).optional(),
  cuisine: z.string().trim().max(100).optional(),
  status: z.enum(['want-to-try', 'been']).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  priceLevel: z.number().int().min(1).max(4).optional(),
});

/**
 * Create a restaurant for a trip — the write side used by the BurgerGo MCP.
 * Best-effort forward-geocodes the address so the restaurant pins on the map.
 * `about` + `notes` fold into the notes field (restaurants have no AI-summary
 * field). Photos are attached separately via POST /api/photos. Protected by
 * isWriteAuthorized (x-api-key when configured).
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  if (!isWriteAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const trip = getTrip(db, tripId);
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = createRestaurantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  const { name, address, about, notes, cuisine, status, rating, priceLevel } = parsed.data;

  let lat: number | null = null;
  let lng: number | null = null;
  let googlePlaceId: string | null = null;
  if (address && env.GOOGLE_MAPS_SERVER_KEY) {
    try {
      const geo = await fetchForwardGeocode({ address, apiKey: env.GOOGLE_MAPS_SERVER_KEY });
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
        googlePlaceId = geo.googlePlaceId;
      }
    } catch {
      // geocode unavailable → save without coordinates (still lists in Eats)
    }
  }

  const combinedNotes = [about, notes].filter(Boolean).join('\n\n') || null;
  const restaurant = addRestaurant(db, {
    tripId,
    name,
    address: address ?? null,
    lat,
    lng,
    googlePlaceId,
    cuisine: cuisine ?? null,
    status: status ?? 'want-to-try',
    rating: rating ?? null,
    priceLevel: priceLevel ?? null,
    notes: combinedNotes,
  });

  return NextResponse.json({ restaurant }, { status: 201 });
}
