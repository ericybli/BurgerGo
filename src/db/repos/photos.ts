import { and, asc, eq, max } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { photos, type Photo } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';
import { photoBasePath } from '@/src/lib/photoPaths';

export type { Photo };

type Db = TestDb['db'];

export type PhotoOwnerType = Photo['ownerType'];

/** One photo row by id, or undefined. */
export function getPhoto(db: Db, id: string): Photo | undefined {
  return db.select().from(photos).where(eq(photos.id, id)).get();
}

/** A single owner's gallery, ordered by order_index ascending. */
export function listByOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo[] {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .all();
}

/**
 * The first photo in an owner's gallery (lowest order_index), or undefined.
 * This is the §5.6 thumbnail-precedence step (1): "first personal photo".
 */
export function firstForOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): Photo | undefined {
  return db
    .select()
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .orderBy(asc(photos.orderIndex))
    .get();
}

/** Highest order_index in an owner's gallery, or -1 when empty. */
function maxOrderIndex(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
): number {
  const row = db
    .select({ m: max(photos.orderIndex) })
    .from(photos)
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId)))
    .get();
  return row?.m ?? -1;
}

export interface AddPhotoInput {
  tripId: string;
  ownerType: PhotoOwnerType;
  ownerId: string;
  width?: number | null;
  height?: number | null;
}

/**
 * Insert a photo row, generating its id and the §5.6 base path
 * `<tripId>/<photoId>`. order_index = max(owner gallery) + 1. The caller
 * (upload route, later group) writes the derivative files to this base path.
 */
export function addPhoto(db: Db, input: AddPhotoInput): Photo {
  const id = newId();
  const row: Photo = {
    id,
    tripId: input.tripId,
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    path: photoBasePath(input.tripId, id),
    width: input.width ?? null,
    height: input.height ?? null,
    orderIndex: maxOrderIndex(db, input.ownerType, input.ownerId) + 1,
    createdAt: new Date(now()),
  };
  db.insert(photos).values(row).run();
  return row;
}

/** Delete a photo row. (File cleanup on the uploads volume is the route's job.) */
export function deletePhoto(db: Db, id: string): void {
  db.delete(photos).where(eq(photos.id, id)).run();
}

/**
 * Renumber an owner's gallery to match `orderedIds`. Ids not in this gallery
 * are ignored; matched ids become order_index 0..n-1. Transactional so a
 * concurrent reader never sees a partially-reordered gallery (mirrors
 * places.reorderDay).
 */
export function reorderOwner(
  db: Db,
  ownerType: PhotoOwnerType,
  ownerId: string,
  orderedIds: string[],
): void {
  db.transaction((tx) => {
    const txDb = tx as unknown as Db;
    const inGallery = new Set(
      listByOwner(txDb, ownerType, ownerId).map((p) => p.id),
    );
    let i = 0;
    for (const id of orderedIds) {
      if (!inGallery.has(id)) continue;
      txDb.update(photos).set({ orderIndex: i }).where(eq(photos.id, id)).run();
      i += 1;
    }
  });
}
