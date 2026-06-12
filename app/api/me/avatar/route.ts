import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { NextResponse } from 'next/server';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { user } from '@/src/db/schema';
import { getPrincipal } from '@/src/lib/authz';
import { now } from '@/src/lib/clock';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

/** Replace the caller's avatar. POST multipart field `image`. */
export async function POST(req: Request) {
  const principal = await getPrincipal(req);
  if (!principal) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (principal.kind !== 'user') return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const image = form.get('image');
  if (!(image instanceof Blob) || image.size === 0 || image.size > MAX_BYTES) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await image.arrayBuffer()))
      .rotate()
      .resize(512, 512, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: 'invalid_image' }, { status: 415 });
  }

  // Filename is the userId (a session-derived UUID) — overwriting IS the
  // replace; ?v= busts client caches. Constrain to UPLOADS_DIR like the photo
  // serving/delete routes anyway.
  const filePath = join(env.UPLOADS_DIR, 'avatars', `${principal.userId}.webp`);
  const resolved = resolve(filePath);
  const root = resolve(env.UPLOADS_DIR);
  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  await mkdir(join(env.UPLOADS_DIR, 'avatars'), { recursive: true });
  await writeFile(filePath, webp);

  const imagePath = `/api/avatars/${principal.userId}?v=${Date.now()}`;
  db.update(user)
    .set({ image: imagePath, updatedAt: new Date(now()) })
    .where(eq(user.id, principal.userId))
    .run();
  return NextResponse.json({ image: imagePath }, { status: 201 });
}
