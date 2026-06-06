import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getPhoto } from '@/src/db/repos/photos';

export const dynamic = 'force-dynamic';

/** Valid size segments (mirror the pipeline derivatives). */
const ALLOWED_SIZES = new Set(['thumb', 'card', 'full']);

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ photoId: string; size: string }> },
): Promise<Response> {
  const { photoId, size } = await ctx.params;

  if (!ALLOWED_SIZES.has(size)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const photo = getPhoto(db, photoId);
  if (!photo) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Resolve <UPLOADS_DIR>/<path>/<size>.webp and constrain to UPLOADS_DIR.
  const filePath = join(env.UPLOADS_DIR, photo.path, `${size}.webp`);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const bytes = await readFile(filePath);
    return new Response(bytes, {
      status: 200,
      headers: {
        'content-type': 'image/webp',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
