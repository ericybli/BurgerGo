import { desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { journalEntries, type JournalEntry } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { JournalEntry };

type Db = TestDb['db'];

/** One entry by id, or undefined. */
export function getEntry(db: Db, id: string): JournalEntry | undefined {
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
}

/** All entries for a trip, newest-written first (created_at desc). */
export function listEntriesForTrip(db: Db, tripId: string): JournalEntry[] {
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.tripId, tripId))
    .orderBy(desc(journalEntries.createdAt))
    .all();
}

export interface AddEntryInput {
  tripId: string;
  title: string;
  body: string; // markdown source; may be ''
  entryDate?: string | null; // YYYY-MM-DD
}

/** Insert an entry; generates id + timestamps. */
export function addEntry(db: Db, input: AddEntryInput): JournalEntry {
  const ts = new Date(now());
  const row: JournalEntry = {
    id: newId(),
    tripId: input.tripId,
    title: input.title,
    body: input.body,
    entryDate: input.entryDate ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(journalEntries).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type EntryPatch = Partial<
  Pick<JournalEntry, 'title' | 'body' | 'entryDate'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateEntry(
  db: Db,
  id: string,
  patch: EntryPatch,
): JournalEntry | undefined {
  db.update(journalEntries)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(journalEntries.id, id))
    .run();
  return getEntry(db, id);
}

/** Delete an entry (its photos are removed by the journal action, not here). */
export function deleteEntry(db: Db, id: string): void {
  db.delete(journalEntries).where(eq(journalEntries.id, id)).run();
}
