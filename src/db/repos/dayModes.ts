import { and, eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import { now } from '@/src/lib/clock';
import { dayModes, type DayMode } from '@/src/db/schema';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

type Db = TestDb['db'];

/**
 * Per-day default travel mode store. Sparse — a row exists only for a day the
 * user explicitly set; callers treat a missing day as `DEFAULT_DAY_MODE`.
 */

/** All stored per-day mode overrides for a trip. */
export function listDayModes(db: Db, tripId: string): DayMode[] {
  return db.select().from(dayModes).where(eq(dayModes.tripId, tripId)).all();
}

/** Upsert a day's default travel mode (keyed by trip + day); returns the row. */
export function setDayMode(db: Db, tripId: string, dayDate: string, mode: TravelMode): DayMode {
  const updatedAt = new Date(now());
  db.insert(dayModes)
    .values({ tripId, dayDate, mode, updatedAt })
    .onConflictDoUpdate({
      target: [dayModes.tripId, dayModes.dayDate],
      set: { mode, updatedAt },
    })
    .run();
  return db
    .select()
    .from(dayModes)
    .where(and(eq(dayModes.tripId, tripId), eq(dayModes.dayDate, dayDate)))
    .get()!;
}
