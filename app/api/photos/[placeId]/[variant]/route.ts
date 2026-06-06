import { readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ placeId: string; variant: string }> },
) {
  const { placeId } = await ctx.params;

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

  // Stream the file from the uploads directory.
  const filePath = join(env.UPLOADS_DIR, cacheRow.photoLocalPath);
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
