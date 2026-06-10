/**
 * Maintenance: re-download every cached Google place photo at the new 3-tier
 * sizes (full ≤1600 / card ≤800 / thumb ≤320). Photos cached before the tiers
 * existed are a single ~800px card file (+ maybe a -thumb sibling), which is
 * blurry on full-width phone cards; this overwrites each photo's files in
 * place — same `gphotos/<id>.webp` base, so `place_details_cache` rows keep
 * their photoLocalPath and nothing in the DB needs to change.
 *
 * For each place_details_cache row with a photoRef + photoLocalPath the photo
 * is refetched with the stored reference. Google photo references go stale, so
 * when that fetch fails the script refreshes the row's Place Details first
 * (fresh photo_reference, persisted on the cache row) and retries once. Each
 * row logs OK/FAIL; a final count is printed.
 *
 * With --dry: report what would happen; no Google photo downloads, no DB writes.
 *
 * Google's server key is IP-restricted to the prod host, so this must run there
 * (inside the app container, which has the key + native better-sqlite3/sharp +
 * the /data volumes). Bundle with esbuild and run with node:
 *
 *   esbuild scripts/refetch-google-photos.ts --bundle --platform=node \
 *     --target=node22 --format=esm --external:better-sqlite3 --external:sharp \
 *     --tsconfig=tsconfig.json --outfile=/tmp/refetch-gphotos.mjs
 *   docker compose cp /tmp/refetch-gphotos.mjs app:/app/refetch-gphotos.mjs
 *   docker compose exec -T app node /app/refetch-gphotos.mjs        # add --dry to preview
 */
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import { placeDetailsCache } from '@/src/db/schema';
import { upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPlaceDetails } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

const DRY = process.argv.includes('--dry');

async function main(): Promise<void> {
  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    console.error('GOOGLE_MAPS_SERVER_KEY is not set — run this inside the prod app container.');
    process.exit(1);
  }
  const apiKey: string = env.GOOGLE_MAPS_SERVER_KEY;

  const all = db.select().from(placeDetailsCache).all();
  const rows = all.filter((r) => r.photoRef && r.photoLocalPath);

  console.log(
    `${all.length} cached place rows (${rows.length} with a photoRef + photoLocalPath)` +
      `${DRY ? ' (DRY RUN)' : ''}\n`,
  );

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    const label = row.name ?? row.googlePlaceId;
    try {
      if (DRY) {
        console.log(`WOULD  ${label} -> refetch ${row.photoLocalPath} at full/card/thumb`);
        ok++;
        continue;
      }

      // First attempt with the stored reference. fetchAndStoreGooglePhoto writes
      // the card-size base over the existing photoLocalPath plus -full/-thumb
      // siblings, so the DB row stays valid as-is.
      let path = await fetchAndStoreGooglePhoto({
        photoRef: row.photoRef!,
        googlePlaceId: row.googlePlaceId,
        apiKey,
        uploadsDir: env.UPLOADS_DIR,
      });

      // A failed fetch is almost always a stale photo_reference (they expire) —
      // refresh the place details for a fresh one, persist it, and retry once.
      if (!path) {
        const d = await fetchPlaceDetails({ placeId: row.googlePlaceId, apiKey });
        upsertDetails(db, {
          googlePlaceId: row.googlePlaceId,
          name: d.name || row.name,
          address: d.address || row.address,
          lat: d.lat,
          lng: d.lng,
          categoryGuess: d.categoryGuess,
          photoRef: d.photoRef,
          photoLocalPath: row.photoLocalPath, // keep the same base — files are overwritten in place
          rawJson: JSON.stringify(d),
          fetchedAt: new Date(now()),
        });
        if (!d.photoRef) {
          failed++;
          console.log(`FAIL   ${label} — place no longer has a Google photo (kept existing files)`);
          continue;
        }
        path = await fetchAndStoreGooglePhoto({
          photoRef: d.photoRef,
          googlePlaceId: row.googlePlaceId,
          apiKey,
          uploadsDir: env.UPLOADS_DIR,
        });
      }

      if (!path) {
        failed++;
        console.log(`FAIL   ${label} — photo download failed after refresh (kept existing files)`);
        continue;
      }
      ok++;
      console.log(
        `OK     ${label} -> ${path}` +
          (path === row.photoLocalPath ? '' : ` (NOTE: differs from stored ${row.photoLocalPath})`),
      );
    } catch (err) {
      failed++;
      console.log(`FAIL   ${label}: ${(err as Error)?.message ?? String(err)}`);
    }
  }

  console.log(`\nDone. ok=${ok} failed=${failed} total=${rows.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
