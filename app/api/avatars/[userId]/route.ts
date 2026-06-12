import { readFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';
import { env } from '@/src/env';

export const dynamic = 'force-dynamic';

/** Serve a user's avatar (tokenless — avatars are public; ?v= busts caches). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const { userId } = await ctx.params;

  // Resolve <UPLOADS_DIR>/avatars/<userId>.webp and constrain to UPLOADS_DIR.
  const filePath = join(env.UPLOADS_DIR, 'avatars', `${userId}.webp`);
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
