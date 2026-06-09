/**
 * Maintenance: backfill persisted Google place data (star rating, review
 * count, weekday hour lines) for every saved restaurant with a
 * google_place_id, and cache its Google photo if missing. New/edited
 * restaurants get this automatically via refreshRestaurantGoogleAction; this
 * script covers the ones saved before the feature existed.
 *
 * With --dry: report what would happen; no Google calls beyond Details, no DB
 * writes.
 *
 * Google's server key is IP-restricted to the prod host, so this must run
 * there (inside the app container). Bundle with esbuild and run with node:
 *
 *   esbuild scripts/backfill-restaurant-google.ts --bundle --platform=node \
 *     --target=node22 --format=esm --external:better-sqlite3 --external:sharp \
 *     --tsconfig=tsconfig.json --outfile=/tmp/backfill-google.mjs
 *   docker compose cp /tmp/backfill-google.mjs app:/app/backfill-google.mjs
 *   docker compose exec -T app node /app/backfill-google.mjs        # add --dry to preview
 */
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import { restaurants } from '@/src/db/schema';
import { updateRestaurant } from '@/src/db/repos/restaurants';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPoiDetailsRich } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

const DRY = process.argv.includes('--dry');

async function main(): Promise<void> {
  const key = env.GOOGLE_MAPS_SERVER_KEY;
  if (!key) {
    console.error('GOOGLE_MAPS_SERVER_KEY missing — run inside the prod container.');
    process.exit(1);
  }

  const rows = db.select().from(restaurants).all();
  let updated = 0;
  let skipped = 0;
  for (const r of rows) {
    if (!r.googlePlaceId) {
      console.log(`- ${r.name}: no google_place_id — skipped`);
      skipped += 1;
      continue;
    }
    try {
      const d = await fetchPoiDetailsRich({ placeId: r.googlePlaceId, apiKey: key });
      const hours = d.hours.length > 0 ? JSON.stringify(d.hours) : null;
      console.log(
        `✓ ${r.name}: rating ${d.rating ?? '—'} (${d.ratingCount ?? 0}) · ${d.hours.length} hour lines` +
          (DRY ? ' [dry]' : ''),
      );
      if (DRY) continue;

      // Cache the Google photo once if absent (Eats/map thumbnails).
      const cached = getCachedDetails(db, r.googlePlaceId);
      if (!cached?.photoLocalPath && d.photoRefs[0]) {
        const photoLocalPath = await fetchAndStoreGooglePhoto({
          photoRef: d.photoRefs[0],
          googlePlaceId: r.googlePlaceId,
          apiKey: key,
          uploadsDir: env.UPLOADS_DIR,
        });
        upsertDetails(db, {
          googlePlaceId: r.googlePlaceId,
          name: cached?.name ?? d.name,
          address: cached?.address ?? d.address,
          lat: cached?.lat ?? d.lat,
          lng: cached?.lng ?? d.lng,
          categoryGuess: cached?.categoryGuess ?? d.categoryGuess,
          photoRef: d.photoRefs[0],
          photoLocalPath,
          rawJson: cached?.rawJson ?? null,
          fetchedAt: new Date(now()),
        });
        console.log(`  photo cached: ${photoLocalPath ?? 'failed'}`);
      }

      updateRestaurant(db, r.id, {
        googleRating: d.rating,
        googleRatingCount: d.ratingCount,
        googleHours: hours,
        googleDataUpdatedAt: new Date(now()),
      });
      updated += 1;
    } catch (err) {
      console.log(`✗ ${r.name}: ${(err as Error).message}`);
      skipped += 1;
    }
  }
  console.log(`done: ${updated} updated, ${skipped} skipped, ${rows.length} total`);
}

void main();
