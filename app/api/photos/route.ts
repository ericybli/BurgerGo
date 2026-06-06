import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { getPlace } from '@/src/db/repos/places';
import {
  addPhoto,
  listByOwner,
  type Photo,
} from '@/src/db/repos/photos';
import {
  validateUpload,
  processPhoto,
} from '@/src/lib/photos/pipeline';
import { newId } from '@/src/db/ids';

export const dynamic = 'force-dynamic';

/** Per-place max personal photos (Plan-2 public-app guard). */
const MAX_PER_OWNER = 12;

/** Photo DTO returned to the client (full row + relative-path base). */
export type PhotoDTO = Photo;

export async function POST(req: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const image = form.get('image');
  const tripId = form.get('tripId');
  const ownerType = form.get('ownerType');
  const ownerId = form.get('ownerId');

  // Field presence + types.
  if (!(image instanceof Blob) || image.size === 0) {
    return NextResponse.json({ error: 'missing_image' }, { status: 400 });
  }
  if (typeof tripId !== 'string' || typeof ownerId !== 'string' || tripId === '' || ownerId === '') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  // Only 'place' is accepted in Plan 2.
  if (ownerType !== 'place') {
    return NextResponse.json({ error: 'bad_owner_type' }, { status: 400 });
  }

  // Image guards (content type + size cap) before any decode/disk work.
  const guard = validateUpload({ contentType: image.type, byteLength: image.size });
  if (!guard.ok) {
    const status = guard.reason === 'too_large' ? 413 : 415;
    return NextResponse.json({ error: guard.reason }, { status });
  }

  // Owner must exist and belong to the named trip.
  const trip = getTrip(db, tripId);
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const place = getPlace(db, ownerId);
  if (!place || place.tripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Per-owner count cap.
  if (listByOwner(db, 'place', ownerId).length >= MAX_PER_OWNER) {
    return NextResponse.json({ error: 'too_many' }, { status: 409 });
  }

  // Pre-generate the id so the on-disk path base matches the DB row.
  // We pass it to both processPhoto (for the directory name) and addPhoto.
  const photoId = newId();
  let result;
  try {
    const arrayBuf = await image.arrayBuffer();
    result = await processPhoto({
      buffer: Buffer.from(arrayBuf),
      uploadsDir: env.UPLOADS_DIR,
      tripId,
      photoId,
    });
  } catch {
    // sharp could not decode → spoofed content type / corrupt image.
    return NextResponse.json({ error: 'invalid_image' }, { status: 415 });
  }

  // Insert the row with the same id used for the disk path.
  const photo = addPhoto(db, {
    id: photoId,
    tripId,
    ownerType: 'place',
    ownerId,
    width: result.width,
    height: result.height,
  });

  return NextResponse.json({ photo }, { status: 201 });
}
