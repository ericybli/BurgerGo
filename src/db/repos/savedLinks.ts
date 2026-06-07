import { and, desc, eq, isNull } from 'drizzle-orm';
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

/** Trip reading-list links (place_id IS NULL), newest first. */
export function listLinksForTrip(db: Db, tripId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(and(eq(savedLinks.tripId, tripId), isNull(savedLinks.placeId)))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}

/** Links attached to a place, newest first. */
export function listLinksForPlace(db: Db, placeId: string): SavedLink[] {
  return db
    .select()
    .from(savedLinks)
    .where(eq(savedLinks.placeId, placeId))
    .orderBy(desc(savedLinks.createdAt))
    .all();
}

export interface AddLinkInput {
  tripId: string;
  url: string;
  title?: string | null;
  note?: string | null;
  thumbnail?: string | null; // relative derivative path
  placeId?: string | null;   // null = trip reading list
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
    placeId: input.placeId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(savedLinks).values(row).run();
  return row;
}

/**
 * Editable subset (never id/tripId/timestamps). NOTE: `url` is patchable, but
 * the repo only stores the string — it performs no fetch, so storing any URL is
 * not itself an SSRF vector. The link-preview route SSRF-validates independently
 * before fetching; the update action should still run `isHttpUrl` on a changed
 * `url` for data hygiene.
 */
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
