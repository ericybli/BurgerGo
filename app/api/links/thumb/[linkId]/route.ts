import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getLink } from '@/src/db/repos/savedLinks';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ linkId: string }> },
): Promise<Response> {
  const { linkId } = await ctx.params;

  const link = getLink(db, linkId);
  if (!link || !link.thumbnail) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Resolve <UPLOADS_DIR>/<thumbnail> and constrain strictly under UPLOADS_DIR.
  const filePath = join(env.UPLOADS_DIR, link.thumbnail);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (!resolved.startsWith(root + sep)) {
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
