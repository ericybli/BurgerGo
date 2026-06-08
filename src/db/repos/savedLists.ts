import { asc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { savedLists, places, type SavedListRow } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

type Db = TestDb['db'];

export type { SavedListRow };

/** All of a trip's saved lists, in display order. */
export function listByTrip(db: Db, tripId: string): SavedListRow[] {
  return db
    .select()
    .from(savedLists)
    .where(eq(savedLists.tripId, tripId))
    .orderBy(asc(savedLists.orderIndex))
    .all();
}

function maxOrderIndex(db: Db, tripId: string): number {
  const rows = db.select({ o: savedLists.orderIndex }).from(savedLists).where(eq(savedLists.tripId, tripId)).all();
  return rows.reduce((m, r) => Math.max(m, r.o), -1);
}

/** Create a list, appended to the end of the trip's lists. */
export function addList(db: Db, tripId: string, name: string): SavedListRow {
  const ts = new Date(now());
  const row: SavedListRow = {
    id: newId(),
    tripId,
    name,
    orderIndex: maxOrderIndex(db, tripId) + 1,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(savedLists).values(row).run();
  return row;
}

/** Rename a list; returns the updated row, or undefined if it doesn't exist. */
export function renameList(db: Db, id: string, name: string): SavedListRow | undefined {
  db.update(savedLists).set({ name, updatedAt: new Date(now()) }).where(eq(savedLists.id, id)).run();
  return db.select().from(savedLists).where(eq(savedLists.id, id)).get();
}

/**
 * Delete a list. Its member places become "loose" (list_id → NULL) first — they
 * are never deleted — then the list row is removed. Done in one transaction;
 * the explicit un-grouping is also required because the ALTER-added FK has no
 * ON DELETE action and foreign_keys is ON.
 */
export function deleteList(db: Db, id: string): void {
  db.transaction((tx) => {
    const txDb = tx as unknown as Db;
    txDb.update(places).set({ listId: null, updatedAt: new Date(now()) }).where(eq(places.listId, id)).run();
    txDb.delete(savedLists).where(eq(savedLists.id, id)).run();
  });
}
