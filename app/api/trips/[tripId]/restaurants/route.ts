import { NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listRestaurants } from '@/src/db/repos/restaurants';
import { places, type Restaurant } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/**
 * RestaurantDTO: all Restaurant fields + scheduledDayDate resolved from the
 * linked place's dayDate (null when not scheduled or the place is gone).
 */
export interface RestaurantDTO extends Restaurant {
  scheduledDayDate: string | null;
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

  const restaurantsResult: RestaurantDTO[] = rows.map((r) => ({
    ...r,
    scheduledDayDate: r.linkedPlaceId ? (dayMap.get(r.linkedPlaceId) ?? null) : null,
  }));

  return NextResponse.json({ restaurants: restaurantsResult });
}
