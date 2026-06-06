import { readFileSync } from 'node:fs';
import { join, resolve, sep, extname } from 'node:path';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { places } from '@/src/db/schema';
import { getCachedDetails } from '@/src/db/repos/placeCache';

export const dynamic = 'force-dynamic';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * Allowed photo size variants. 1B stores a single image file and all valid
 * variants currently resolve to that one photoLocalPath; true per-size files
 * are a later plan (B3+).
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

  // Constrain the resolved path to UPLOADS_DIR to prevent path traversal.
  const filePath = join(env.UPLOADS_DIR, cacheRow.photoLocalPath);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Stream the file from the uploads directory.
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
