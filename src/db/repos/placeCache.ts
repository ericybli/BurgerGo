import { eq } from 'drizzle-orm';
import type { TestDb } from '@/src/db/testDb';
import {
  placeDetailsCache,
  type PlaceDetailsCacheRow,
  type NewPlaceDetailsCacheRow,
} from '@/src/db/schema';

type Db = TestDb['db'];

/** Read a cached Place Details row by Google place id, or undefined on a miss. */
export function getCachedDetails(
  db: Db,
  googlePlaceId: string,
): PlaceDetailsCacheRow | undefined {
  return db
    .select()
    .from(placeDetailsCache)
    .where(eq(placeDetailsCache.googlePlaceId, googlePlaceId))
    .get();
}

/**
 * Insert or refresh a cached Place Details row, keyed by googlePlaceId (PK).
 * On conflict every non-key column is overwritten with the incoming value.
 */
export function upsertDetails(
  db: Db,
  row: NewPlaceDetailsCacheRow,
): PlaceDetailsCacheRow {
  db.insert(placeDetailsCache)
    .values(row)
    .onConflictDoUpdate({
      target: placeDetailsCache.googlePlaceId,
      set: {
        name: row.name ?? null,
        address: row.address ?? null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        categoryGuess: row.categoryGuess ?? null,
        photoRef: row.photoRef ?? null,
        photoLocalPath: row.photoLocalPath ?? null,
        rawJson: row.rawJson ?? null,
        fetchedAt: row.fetchedAt,
      },
    })
    .run();
  return getCachedDetails(db, row.googlePlaceId) as PlaceDetailsCacheRow;
}
