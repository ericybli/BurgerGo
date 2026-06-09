import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { getPlace } from '@/src/db/repos/places';
import { getEntry } from '@/src/db/repos/journalEntries';
import { getRestaurant } from '@/src/db/repos/restaurants';
import { getPhotoList } from '@/src/db/repos/photoLists';
import {
  addPhoto,
  listByOwner,
  type Photo,
  type PhotoOwnerType,
} from '@/src/db/repos/photos';
import {
  validateUpload,
  processPhoto,
} from '@/src/lib/photos/pipeline';
import { newId } from '@/src/db/ids';

export const dynamic = 'force-dynamic';

/** Per-owner max personal photos (Plan-2 public-app guard; reused for journal). */
const MAX_PER_OWNER = 12;

/** Owner types that may receive uploads (Plan 3 'journal'; Plan 4 'restaurant'; Photography 'photo_list'). */
const OWNER_TYPES: readonly PhotoOwnerType[] = ['place', 'journal', 'restaurant', 'photo_list'];

/** Photo DTO returned to the client (full row). */
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
  if (typeof ownerType !== 'string' || !OWNER_TYPES.includes(ownerType as PhotoOwnerType)) {
    return NextResponse.json({ error: 'bad_owner_type' }, { status: 400 });
  }
  const owner = ownerType as PhotoOwnerType;

  // Image guards (content type + size cap) before any decode/disk work.
  const guard = validateUpload({ contentType: image.type, byteLength: image.size });
  if (!guard.ok) {
    const status = guard.reason === 'too_large' ? 413 : 415;
    return NextResponse.json({ error: guard.reason }, { status });
  }

  // Owner must exist and belong to the named trip.
  const trip = getTrip(db, tripId);
  if (!trip) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const ownerTripId =
    owner === 'place'
      ? getPlace(db, ownerId)?.tripId
      : owner === 'restaurant'
        ? getRestaurant(db, ownerId)?.tripId
        : owner === 'photo_list'
          ? getPhotoList(db, ownerId)?.tripId
          : getEntry(db, ownerId)?.tripId;
  if (ownerTripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Per-owner count cap.
  if (listByOwner(db, owner, ownerId).length >= MAX_PER_OWNER) {
    return NextResponse.json({ error: 'too_many' }, { status: 409 });
  }

  // Pre-generate the id so the on-disk path base matches the DB row.
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
    ownerType: owner,
    ownerId,
    width: result.width,
    height: result.height,
  });

  return NextResponse.json({ photo }, { status: 201 });
}
