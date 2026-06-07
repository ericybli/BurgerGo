import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { listEntriesForTrip, type JournalEntry } from '@/src/db/repos/journalEntries';
import { listLinksForTrip, type SavedLink } from '@/src/db/repos/savedLinks';
import { photos, type Photo } from '@/src/db/schema';

export const dynamic = 'force-dynamic';

/** EntryDTO: a journal entry row + its attached journal photos (order_index asc). */
export type EntryDTO = JournalEntry & { photos: Photo[] };

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const rawEntries = listEntriesForTrip(db, tripId);
  const entryIds = rawEntries.map((e) => e.id);

  // Batch all journal photos for this trip's entries in one query (no N+1).
  const photoMap = new Map<string, Photo[]>();
  if (entryIds.length > 0) {
    const rows = db
      .select()
      .from(photos)
      .where(and(eq(photos.ownerType, 'journal'), inArray(photos.ownerId, entryIds)))
      .orderBy(photos.orderIndex)
      .all();
    for (const row of rows) {
      const list = photoMap.get(row.ownerId) ?? [];
      list.push(row);
      photoMap.set(row.ownerId, list);
    }
  }

  const entries: EntryDTO[] = rawEntries.map((e) => ({
    ...e,
    photos: photoMap.get(e.id) ?? [],
  }));

  const links: SavedLink[] = listLinksForTrip(db, tripId);

  return NextResponse.json({ entries, links });
}
