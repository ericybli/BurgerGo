import { readFileSync } from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getRestaurant } from '@/src/db/repos/restaurants';
import { getCachedDetails } from '@/src/db/repos/placeCache';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/** All valid variants currently resolve to the one cached Google photo file. */
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

  // Constrain the resolved path to UPLOADS_DIR to prevent path traversal.
  const filePath = join(env.UPLOADS_DIR, cacheRow.photoLocalPath);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const bytes = readFileSync(filePath);
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
