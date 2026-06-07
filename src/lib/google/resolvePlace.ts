import type { TestDb } from '@/src/db/testDb';
import { now } from '@/src/lib/clock';
import { getCachedDetails, upsertDetails } from '@/src/db/repos/placeCache';
import { fetchPlaceAutocomplete, fetchPlaceDetails, type CategoryGuess } from '@/src/lib/google/server';
import { fetchAndStoreGooglePhoto } from '@/src/lib/google/photo';

type Db = TestDb['db'];

export interface ResolvedPlace {
  googlePlaceId: string;
  name: string;
  address: string | null;
  /** null when Google returned no usable geometry. */
  lat: number | null;
  lng: number | null;
  categoryGuess: CategoryGuess;
  photoLocalPath: string | null;
}

export interface ResolvePlaceInput {
  name: string;
  /** City / region hint to disambiguate the lookup (from AI or the trip). */
  area?: string;
  apiKey: string;
  uploadsDir: string;
}

/** (0,0) is never a real venue — treat it as "no coordinates". */
function coords(lat: number, lng: number): { lat: number | null; lng: number | null } {
  if (lat === 0 && lng === 0) return { lat: null, lng: null };
  return { lat, lng };
}

/**
 * Resolve a bare place/restaurant name to a real Google place: autocomplete the
 * "name + area" query, take the top prediction, fetch its details, and download +
 * cache its photo (so imported places get a cover image). Returns null when
 * Google has no match. Reuses an already-cached details row when present.
 *
 * Server-only (Google server key); the IP-restricted key means this only works
 * from the prod host, like the rest of the Google integration.
 */
export async function resolvePlaceByName(db: Db, input: ResolvePlaceInput): Promise<ResolvedPlace | null> {
  const query = [input.name, input.area].filter((s) => s && s.trim()).join(' ').trim();
  if (!query) return null;

  const predictions = await fetchPlaceAutocomplete({ input: query, apiKey: input.apiKey });
  const placeId = predictions[0]?.placeId;
  if (!placeId) return null;

  // Reuse a cached details row (incl. its downloaded photo) when we have one.
  const cached = getCachedDetails(db, placeId);
  if (cached && cached.lat != null && cached.lng != null) {
    return {
      googlePlaceId: cached.googlePlaceId,
      name: cached.name || input.name,
      address: cached.address,
      lat: cached.lat,
      lng: cached.lng,
      categoryGuess: (cached.categoryGuess as CategoryGuess) || 'other',
      photoLocalPath: cached.photoLocalPath,
    };
  }

  const d = await fetchPlaceDetails({ placeId, apiKey: input.apiKey });
  const gid = d.googlePlaceId || placeId;

  let photoLocalPath: string | null = cached?.photoLocalPath ?? null;
  if (d.photoRef && !photoLocalPath) {
    photoLocalPath = await fetchAndStoreGooglePhoto({
      photoRef: d.photoRef,
      googlePlaceId: gid,
      apiKey: input.apiKey,
      uploadsDir: input.uploadsDir,
    });
  }

  upsertDetails(db, {
    googlePlaceId: gid,
    name: d.name,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
    categoryGuess: d.categoryGuess,
    photoRef: d.photoRef,
    photoLocalPath,
    rawJson: JSON.stringify(d),
    fetchedAt: new Date(now()),
  });

  const { lat, lng } = coords(d.lat, d.lng);
  return {
    googlePlaceId: gid,
    name: d.name || input.name,
    address: d.address || null,
    lat,
    lng,
    categoryGuess: d.categoryGuess,
    photoLocalPath,
  };
}
