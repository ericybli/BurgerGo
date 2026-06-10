import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { places } from '@/src/db/schema';
import { getCachedDetails } from '@/src/db/repos/placeCache';
import { serveCachedGooglePhoto } from '@/src/lib/photos/serveGooglePhoto';

export const dynamic = 'force-dynamic';

/**
 * Allowed photo size variants. Google photos store a card-size base file plus
 * `-thumb`/`-full` siblings; `thumb` and `full` serve their derivative (falling
 * back to the card file for photos fetched before that tier existed), `card`
 * serves the base file.
 */
const ALLOWED_VARIANTS = new Set(['thumb', 'card', 'full']);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ placeId: string; variant: string }> },
) {
  const { placeId, variant } = await ctx.params;

  // Validate the variant segment against the allowed set.
  if (!ALLOWED_VARIANTS.has(variant)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Look up the place to get its googlePlaceId.
  const place = db
    .select()
    .from(places)
    .where(eq(places.id, placeId))
    .get();
  if (!place) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!place.googlePlaceId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Look up the cache row for the photo local path.
  const cacheRow = getCachedDetails(db, place.googlePlaceId);
  if (!cacheRow?.photoLocalPath) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return serveCachedGooglePhoto(cacheRow.photoLocalPath, variant);
}
