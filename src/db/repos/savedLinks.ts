import { desc, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { savedLinks, type SavedLink } from '@/src/db/schema';
import { newId } from '@/src/db/ids';
import { now } from '@/src/lib/clock';

export type { SavedLink };

type Db = TestDb['db'];

/** One link by id, or undefined. */
export function getLink(db: Db, id: string): SavedLink | undefined {
  return db.select().from(savedLinks).where(eq(savedLinks.id, id)).get();
}

/** All links for a trip, newest first (created_at desc). */
export function listLinksForTrip(db: Db, tripId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(eq(savedLinks.tripId, tripId))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}

export interface AddLinkInput {
  tripId: string;
  url: string;
  title?: string | null;
  note?: string | null;
  thumbnail?: string | null; // relative derivative path
}

/** Insert a link; generates id + timestamps. */
export function addLink(db: Db, input: AddLinkInput): SavedLink {
  const ts = new Date(now());
  const row: SavedLink = {
    id: newId(),
    tripId: input.tripId,
    url: input.url,
    title: input.title ?? null,
    note: input.note ?? null,
    thumbnail: input.thumbnail ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(savedLinks).values(row).run();
  return row;
}

/** Editable subset (never id/tripId/timestamps). */
export type LinkPatch = Partial<
  Pick<SavedLink, 'url' | 'title' | 'note' | 'thumbnail'>
>;

/** Patch the provided fields; bumps updatedAt. Returns the row, or undefined. */
export function updateLink(
  db: Db,
  id: string,
  patch: LinkPatch,
): SavedLink | undefined {
  db.update(savedLinks)
    .set({ ...patch, updatedAt: new Date(now()) })
    .where(eq(savedLinks.id, id))
    .run();
  return getLink(db, id);
}

/** Delete a link (its thumbnail file is removed best-effort by the action). */
export function deleteLink(db: Db, id: string): void {
  db.delete(savedLinks).where(eq(savedLinks.id, id)).run();
}
