import { eq, and } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { dayTitles, type DayTitle } from '@/src/db/schema';
import { now } from '@/src/lib/clock';

type Db = TestDb['db'];

export type { DayTitle };

/** All of a trip's day titles (sparse — only titled days have rows). */
export function listDayTitles(db: Db, tripId: string): DayTitle[] {
  return db.select().from(dayTitles).where(eq(dayTitles.tripId, tripId)).all();
}

/**
 * Set (upsert) or clear (null/empty → delete) one day's title.
 * Mirrors dayModes' sparse-row semantics.
 */
export function setDayTitle(
  db: Db,
  tripId: string,
  dayDate: string,
  title: string | null,
): void {
  const trimmed = title?.trim() ?? '';
  if (trimmed === '') {
    db.delete(dayTitles)
      .where(and(eq(dayTitles.tripId, tripId), eq(dayTitles.dayDate, dayDate)))
      .run();
    return;
  }
  db.insert(dayTitles)
    .values({ tripId, dayDate, title: trimmed, updatedAt: new Date(now()) })
    .onConflictDoUpdate({
      target: [dayTitles.tripId, dayTitles.dayDate],
      set: { title: trimmed, updatedAt: new Date(now()) },
    })
    .run();
}
