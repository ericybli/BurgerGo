import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getRestaurant } from '@/src/db/repos/restaurants';
import { getCachedDetails } from '@/src/db/repos/placeCache';
import { serveCachedGooglePhoto } from '@/src/lib/photos/serveGooglePhoto';

export const dynamic = 'force-dynamic';

/** `thumb` serves the small derivative (fallback to card); `card`/`full` the card file. */
const ALLOWED_VARIANTS = new Set(['thumb', 'card', 'full']);

/**
 * Serve a restaurant's cached Google place photo: restaurant → googlePlaceId →
 * place_details_cache.photoLocalPath → file under UPLOADS_DIR. 404s when the
 * restaurant has no linked Google place or no cached photo. Personal uploads are
 * served by the owner-agnostic /api/photos/p/[photoId]/[size] handler instead.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ restaurantId: string; variant: string }> },
) {
  const { restaurantId, variant } = await ctx.params;

  if (!ALLOWED_VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const restaurant = getRestaurant(db, restaurantId);
  if (!restaurant?.googlePlaceId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const cacheRow = getCachedDetails(db, restaurant.googlePlaceId);
  if (!cacheRow?.photoLocalPath) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return serveCachedGooglePhoto(cacheRow.photoLocalPath, variant);
}
