/**
 * Maintenance: re-fetch the Google place photo for every saved restaurant.
 *
 * Default run (refresh): for each restaurant that has a google_place_id, re-queries
 * Google Place Details (fresh photo_reference), downloads + re-encodes the photo into
 * the shared `uploads/gphotos/<placeId>.webp`, and refreshes its place_details_cache
 * row so /api/photos/r/[id] serves it. An existing photo is NEVER nulled when a
 * refetch yields no photo — this only ever adds or refreshes, never regresses.
 *
 * With --resolve: restaurants whose pin is an ADDRESS-type place id (geocoded
 * address → no Google photos, e.g. from the AI-import name→address flow) are
 * re-resolved to their real business listing via Find Place From Text (name +
 * address, location-biased). The candidate is adopted only when it has photos,
 * is a food/establishment type, and its name matches — then the restaurant's
 * google_place_id + lat/lng are corrected (fixes the map pin too) and the photo
 * is fetched. Ambiguous matches are skipped and reported.
 *
 * With --dry: report what would happen; no Google photo downloads, no DB writes.
 *
 * Google's server key is IP-restricted to the prod host, so this must run there
 * (inside the app container, which has the key + native better-sqlite3/sharp +
 * the /data volumes). Bundle with esbuild and run with node:
 *
 *   esbuild scripts/refetch-restaurant-photos.ts --bundle --platform=node \
 *     --target=node22 --format=esm --external:better-sqlite3 --external:sharp \
 *     --tsconfig=tsconfig.json --outfile=/tmp/refetch.mjs
 *   docker compose cp /tmp/refetch.mjs app:/app/refetch.mjs
 *   docker compose exec -T app node /app/refetch.mjs --resolve     # add --dry to preview
 */
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { now } from '@/src/lib/clock';
import { restaurants } from '@/src/db/schema';
import { updateRestaurant } from '@/src/db/repos/restaurants';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPlaceDetails, type NormalizedDetails } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

const DRY = process.argv.includes('--dry');
const RESOLVE = process.argv.includes('--resolve');

const FINDPLACE_URL = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
const FOOD_RE = /restaurant|food|cafe|bakery|bar|meal_takeaway|meal_delivery|store|grocery|supermarket|establishment|point_of_interest/;

function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Loose match: one name contains the other, or they share ≥2 (or all short) tokens. */
function nameMatches(saved: string, found: string): boolean {
  const a = normName(saved);
  const b = normName(found);
  if (!a || !b) return false;
  if (b.includes(a) || a.includes(b)) return true;
  const at = new Set(a.split(' '));
  const overlap = b.split(' ').filter((t) => at.has(t)).length;
  return overlap >= Math.min(2, at.size);
}

interface FindResult {
  placeId: string;
  name: string;
}

/** Find the real business POI for an address-pinned restaurant; null if none/uncertain. */
async function findBusiness(
  name: string,
  address: string | null,
  lat: number | null,
  lng: number | null,
  apiKey: string,
): Promise<FindResult | null> {
  const params = new URLSearchParams({
    input: `${name} ${address ?? ''}`.trim(),
    inputtype: 'textquery',
    fields: 'place_id,name,types,photos',
    key: apiKey,
  });
  if (typeof lat === 'number' && typeof lng === 'number') {
    params.set('locationbias', `circle:3000@${lat},${lng}`);
  }
  const r = (await fetch(`${FINDPLACE_URL}?${params.toString()}`, {
    signal: AbortSignal.timeout(8000),
  }).then((x) => x.json())) as {
    candidates?: Array<{ place_id?: string; name?: string; types?: string[]; photos?: unknown[] }>;
  };
  const c = r.candidates?.[0];
  if (!c?.place_id) return null;
  const hasPhoto = (c.photos?.length ?? 0) > 0;
  const isFood = (c.types ?? []).some((t) => FOOD_RE.test(t));
  if (!hasPhoto || !isFood || !nameMatches(name, c.name ?? '')) return null;
  return { placeId: c.place_id, name: c.name ?? '' };
}

/** Download + cache the photo for `placeId` from already-fetched details; returns the rel path. */
async function storePhoto(placeId: string, d: NormalizedDetails, apiKey: string): Promise<string | null> {
  if (!d.photoRef) return null;
  const path = await fetchAndStoreGooglePhoto({
    photoRef: d.photoRef,
    googlePlaceId: placeId,
    apiKey,
    uploadsDir: env.UPLOADS_DIR,
  });
  if (path) {
    upsertDetails(db, {
      googlePlaceId: placeId,
      name: d.name,
      address: d.address,
      lat: d.lat,
      lng: d.lng,
      categoryGuess: d.categoryGuess,
      photoRef: d.photoRef,
      photoLocalPath: path,
      rawJson: JSON.stringify(d),
      fetchedAt: new Date(now()),
    });
  }
  return path;
}

async function main(): Promise<void> {
  if (!env.GOOGLE_MAPS_SERVER_KEY) {
    console.error('GOOGLE_MAPS_SERVER_KEY is not set — run this inside the prod app container.');
    process.exit(1);
  }
  const apiKey: string = env.GOOGLE_MAPS_SERVER_KEY;

  const all = db
    .select({
      id: restaurants.id,
      name: restaurants.name,
      gid: restaurants.googlePlaceId,
      address: restaurants.address,
      lat: restaurants.lat,
      lng: restaurants.lng,
    })
    .from(restaurants)
    .all();
  const withGid = all.filter((r) => r.gid && r.gid.trim() !== '').length;

  console.log(
    `${all.length} restaurants (${withGid} with a Google place id)` +
      `${RESOLVE ? ' [--resolve]' : ''}${DRY ? ' (DRY RUN)' : ''}\n`,
  );

  let refreshed = 0;
  let repinned = 0;
  let linked = 0;
  let noPhoto = 0;
  let skipped = 0;
  let failed = 0;

  // Point restaurant `r` at a freshly-found business POI: fetch its photo, set
  // the restaurant's google_place_id, and correct its coords. Returns true if a
  // photo was adopted. `verb`='re-pin' (had an address-type pin) | 'link' (had none).
  async function adopt(
    r: { id: string; name: string },
    found: FindResult,
    fromLabel: string,
    verb: 're-pin' | 'link',
  ): Promise<boolean> {
    const nd = await fetchPlaceDetails({ placeId: found.placeId, apiKey });
    if (!nd.photoRef) return false;
    if (DRY) {
      console.log(`WOULD  ${r.name} -> ${verb} to "${found.name}" (${found.placeId}) + photo`);
      return true;
    }
    const path = await storePhoto(found.placeId, nd, apiKey);
    updateRestaurant(db, r.id, { googlePlaceId: found.placeId, lat: nd.lat, lng: nd.lng });
    console.log(`${verb === 're-pin' ? 'REPIN' : 'LINK '}  ${r.name} -> "${found.name}" ${fromLabel} → ${found.placeId} -> ${path}`);
    return true;
  }

  for (const r of all) {
    const gid = r.gid?.trim() || null;
    try {
      if (gid) {
        const d = await fetchPlaceDetails({ placeId: gid, apiKey });
        const existingPath = getCachedDetails(db, gid)?.photoLocalPath ?? null;

        // Already has a Google photo → refresh in place.
        if (d.photoRef) {
          if (DRY) console.log(`WOULD  ${r.name} -> refresh existing photo`);
          else {
            const path = await storePhoto(gid, d, apiKey);
            console.log(`OK     ${r.name} -> ${path ?? existingPath}`);
          }
          refreshed++;
          continue;
        }

        // No photo on this pin (address-type) → re-resolve to the real business.
        if (RESOLVE) {
          const found = await findBusiness(r.name, r.address, r.lat, r.lng, apiKey);
          if (found && (await adopt(r, found, gid, 're-pin'))) {
            repinned++;
            continue;
          }
        }
        noPhoto++;
        console.log(`NOPIC  ${r.name} — no Google photo${RESOLVE ? ' (no confident match)' : ''} (kept ${existingPath ?? 'none'})`);
        continue;
      }

      // No Google link at all → try to link it to a business.
      if (!RESOLVE) {
        skipped++;
        console.log(`SKIP   ${r.name} — no Google link (run with --resolve to link)`);
        continue;
      }
      const found = await findBusiness(r.name, r.address, r.lat, r.lng, apiKey);
      if (found && (await adopt(r, found, '(no link)', 'link'))) {
        linked++;
        continue;
      }
      noPhoto++;
      console.log(`NOPIC  ${r.name} — no confident business match (still unlinked)`);
    } catch (err) {
      failed++;
      console.log(`FAIL   ${r.name}: ${(err as Error)?.message ?? String(err)}`);
    }
  }

  console.log(
    `\nDone. refreshed=${refreshed} re-pinned=${repinned} linked=${linked} no-photo=${noPhoto}` +
      `${skipped ? ` skipped=${skipped}` : ''} failed=${failed} total=${all.length}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
