import { asc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { photoLists, type PhotoList } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

type Db = TestDb['db'];

export type { PhotoList };

/** All of a trip's photography lists, in display order. */
export function listByTrip(db: Db, tripId: string): PhotoList[] {
  return db
    .select()
    .from(photoLists)
    .where(eq(photoLists.tripId, tripId))
    .orderBy(asc(photoLists.orderIndex))
    .all();
}

/** One photo list by id, or undefined. */
export function getPhotoList(db: Db, id: string): PhotoList | undefined {
  return db.select().from(photoLists).where(eq(photoLists.id, id)).get();
}

function maxOrderIndex(db: Db, tripId: string): number {
  const rows = db
    .select({ o: photoLists.orderIndex })
    .from(photoLists)
    .where(eq(photoLists.tripId, tripId))
    .all();
  return rows.reduce((m, r) => Math.max(m, r.o), -1);
}

/** Create a list, appended to the end of the trip's lists. */
export function addPhotoList(db: Db, tripId: string, name: string): PhotoList {
  const ts = new Date(now());
  const row: PhotoList = {
    id: newId(),
    tripId,
    name,
    orderIndex: maxOrderIndex(db, tripId) + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(photoLists).values(row).run();
  return row;
}

/** Rename a list; returns the updated row, or undefined if it doesn't exist. */
export function renamePhotoList(db: Db, id: string, name: string): PhotoList | undefined {
  db.update(photoLists).set({ name, updatedAt: new Date(now()) }).where(eq(photoLists.id, id)).run();
  return db.select().from(photoLists).where(eq(photoLists.id, id)).get();
}

/**
 * Delete a list row. The caller (deletePhotoListAction) first removes the
 * list's photos (DB rows + on-disk derivatives), since the generic
 * `photos.owner_id` has no DB-level FK to cascade from this table.
 */
export function deletePhotoList(db: Db, id: string): void {
  db.delete(photoLists).where(eq(photoLists.id, id)).run();
}
