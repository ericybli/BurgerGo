import { readFile } from 'node:fs/promises';
import { join, resolve, sep, extname } from 'node:path';
import { NextResponse } from 'next/server';
import { env } from '@/src/env';
import { googleThumbRelPath } from '@/src/lib/photoPaths';

const MIME: Record<string, string> = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
};

/**
 * Serve a cached Google place photo (`gphotos/<id>.webp`, stored as
 * `photoLocalPath`) for a size variant. For `thumb` it prefers the smaller
 * `-thumb` derivative and falls back to the single card-size file when that
 * sibling isn't present (older photos fetched before thumbs existed). Reads are
 * async (no event-loop block) and every candidate path is constrained under
 * UPLOADS_DIR to prevent traversal. Returns a 404 JSON response on any miss.
 *
 * Shared by the place (`/api/photos/[placeId]/[variant]`) and restaurant
 * (`/api/photos/r/[restaurantId]/[variant]`) photo routes.
 */
export async function serveCachedGooglePhoto(
  photoLocalPath: string,
  variant: string,
): Promise<Response> {
  const root = resolve(env.UPLOADS_DIR);
  const candidates =
    variant === 'thumb' ? [googleThumbRelPath(photoLocalPath), photoLocalPath] : [photoLocalPath];

  for (const rel of candidates) {
    const abs = resolve(join(env.UPLOADS_DIR, rel));
    // Constrain to UPLOADS_DIR (path-traversal guard).
    if (abs !== root && !abs.startsWith(root + sep)) continue;
    try {
      const bytes = await readFile(abs);
      const contentType = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream';
      return new Response(bytes, {
        status: 200,
        headers: {
          'content-type': contentType,
          'cache-control': 'public, max-age=31536000, immutable',
        },
      });
    } catch {
      // Missing/unreadable → try the next candidate (thumb → card fallback).
    }
  }
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}
