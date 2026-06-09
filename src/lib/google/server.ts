/**
 * Server-side Google web-service client. Calls Place Details, Geocoding
 * (reverse), and Directions with the server key and normalizes responses.
 * `fetch` is read from globalThis so tests can stub it; no real key is
 * required to build or test. Every billable call is cache-gated by the
 * proxy route that wraps it.
 */
import type { TravelMode } from '@/src/lib/googleMapsUrl';

const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

/** Minimal Place Details field mask — keeps the Details SKU on the basic tier. */
const DETAILS_FIELDS = 'place_id,name,formatted_address,geometry/location,types,photos';

/** Google Directions `mode` param mapping. */
const DIRECTIONS_MODE: Record<TravelMode, string> = {
  walk: 'walking',
  drive: 'driving',
  transit: 'transit',
};

/** A non-OK Google status (or non-2xx HTTP). */
export class GoogleApiError extends Error {
  constructor(
    public readonly status: string,
    message?: string,
  ) {
    super(message ?? `Google API error: ${status}`);
    this.name = 'GoogleApiError';
  }
}

export type CategoryGuess =
  | 'sightseeing'
  | 'lodging'
  | 'hotel'
  | 'airbnb'
  | 'airport'
  | 'transport'
  | 'activity'
  | 'shopping'
  | 'parking'
  | 'entrance'
  | 'museum'
  | 'event'
  | 'other';

/** Normalized Place Details — written into `place_details_cache`. */
export interface NormalizedDetails {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryGuess: CategoryGuess;
  photoRef: string | null;
}

/** One autocomplete prediction (place id + human-readable description). */
export interface AutocompletePrediction {
  placeId: string;
  description: string;
}

/** Normalized reverse-geocode result. */
export interface NormalizedReverseGeocode {
  address: string | null;
}

/** Normalized forward-geocode result (address → coords); null when no match. */
export interface NormalizedForwardGeocode {
  lat: number;
  lng: number;
  address: string | null;
  /** Google place id of the matched result, when present (enables photo/name auto-fill). */
  googlePlaceId: string | null;
}

/** Normalized Directions — summed across legs; polyline written into `travel_legs`. */
export interface NormalizedDirections {
  durationSeconds: number;
  distanceMeters: number;
  polyline: string;
}

function guessCategory(types: string[] | undefined): CategoryGuess {
  const t = new Set(types ?? []);
  // Google has no Airbnb signal — generic 'lodging' is overwhelmingly hotels.
  if (t.has('lodging')) return 'hotel';
  if (t.has('airport')) return 'airport';
  if (
    t.has('train_station') || t.has('subway_station') ||
    t.has('bus_station') || t.has('transit_station')
  ) return 'transport';
  if (t.has('parking')) return 'parking';
  if (t.has('museum')) return 'museum';
  if (
    t.has('shopping_mall') || t.has('department_store') ||
    t.has('store') || t.has('clothing_store') || t.has('shoe_store')
  ) return 'shopping';
  if (
    t.has('tourist_attraction') || t.has('place_of_worship') ||
    t.has('park') || t.has('art_gallery')
  ) return 'sightseeing';
  if (
    t.has('amusement_park') || t.has('zoo') || t.has('aquarium') ||
    t.has('stadium') || t.has('spa') || t.has('night_club')
  ) return 'activity';
  return 'other';
}

/** One POI review (top Google reviews, trimmed for the map card). */
export interface PoiReview {
  author: string;
  rating: number | null;
  time: string | null;
  text: string;
}

/** Rich Place Details for the map's POI card (basic + contact + atmosphere). */
export interface NormalizedPoiDetails {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  categoryGuess: CategoryGuess;
  rating: number | null;
  ratingCount: number | null;
  openNow: boolean | null;
  /** Localized weekday lines, e.g. "Monday: 9:00 AM – 5:00 PM". */
  hours: string[];
  /** Google's editorial overview, when available. */
  summary: string | null;
  /** Photo references (up to 6) — served via the /api/google/poi-photo proxy. */
  photoRefs: string[];
  reviews: PoiReview[];
}

// --- Pure normalizers (unit-tested directly) ----------------------------------

export function normalizePoiDetails(raw: unknown): NormalizedPoiDetails {
  const r = raw as {
    status?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      photos?: Array<{ photo_reference?: string }>;
      rating?: number;
      user_ratings_total?: number;
      opening_hours?: { open_now?: boolean; weekday_text?: string[] };
      editorial_summary?: { overview?: string };
      reviews?: Array<{
        author_name?: string;
        rating?: number;
        relative_time_description?: string;
        text?: string;
      }>;
    };
  };
  if (r.status !== 'OK' || !r.result) {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Place Details lookup failed');
  }
  const res = r.result;
  return {
    googlePlaceId: res.place_id ?? '',
    name: res.name ?? '',
    address: res.formatted_address ?? '',
    lat: res.geometry?.location?.lat ?? 0,
    lng: res.geometry?.location?.lng ?? 0,
    categoryGuess: guessCategory(res.types),
    rating: typeof res.rating === 'number' ? res.rating : null,
    ratingCount: typeof res.user_ratings_total === 'number' ? res.user_ratings_total : null,
    openNow: typeof res.opening_hours?.open_now === 'boolean' ? res.opening_hours.open_now : null,
    hours: res.opening_hours?.weekday_text ?? [],
    summary: res.editorial_summary?.overview ?? null,
    photoRefs: (res.photos ?? [])
      .map((p) => p.photo_reference)
      .filter((ref): ref is string => typeof ref === 'string' && ref.length > 0)
      .slice(0, 6),
    reviews: (res.reviews ?? [])
      .filter((rv) => typeof rv.text === 'string' && rv.text.trim() !== '')
      .slice(0, 3)
      .map((rv) => ({
        author: rv.author_name ?? '',
        rating: typeof rv.rating === 'number' ? rv.rating : null,
        time: rv.relative_time_description ?? null,
        text: (rv.text ?? '').trim(),
      })),
  };
}

export function normalizeDetails(raw: unknown): NormalizedDetails {
  const r = raw as {
    status?: string;
    result?: {
      place_id?: string;
      name?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
      types?: string[];
      photos?: Array<{ photo_reference?: string }>;
    };
  };
  if (r.status !== 'OK' || !r.result) {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Place Details lookup failed');
  }
  const res = r.result;
  return {
    googlePlaceId: res.place_id ?? '',
    name: res.name ?? '',
    address: res.formatted_address ?? '',
    lat: res.geometry?.location?.lat ?? 0,
    lng: res.geometry?.location?.lng ?? 0,
    categoryGuess: guessCategory(res.types),
    photoRef: res.photos?.[0]?.photo_reference ?? null,
  };
}

export function normalizeAutocomplete(raw: unknown): AutocompletePrediction[] {
  const r = raw as {
    status?: string;
    predictions?: Array<{ place_id?: string; description?: string }>;
  };
  // No matches is a normal, non-error outcome → empty list.
  if (r.status === 'ZERO_RESULTS') return [];
  if (r.status !== 'OK') {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Autocomplete failed');
  }
  return (r.predictions ?? [])
    .filter(
      (p): p is { place_id: string; description: string } =>
        typeof p.place_id === 'string' && typeof p.description === 'string',
    )
    .map((p) => ({ placeId: p.place_id, description: p.description }));
}

export function normalizeReverseGeocode(raw: unknown): NormalizedReverseGeocode {
  const r = raw as { status?: string; results?: Array<{ formatted_address?: string }> };
  if (r.status === 'ZERO_RESULTS') return { address: null };
  if (r.status !== 'OK') {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Reverse geocode failed');
  }
  return { address: r.results?.[0]?.formatted_address ?? null };
}

export function normalizeForwardGeocode(raw: unknown): NormalizedForwardGeocode | null {
  const r = raw as {
    status?: string;
    results?: Array<{
      place_id?: string;
      formatted_address?: string;
      geometry?: { location?: { lat?: number; lng?: number } };
    }>;
  };
  if (r.status === 'ZERO_RESULTS') return null;
  if (r.status !== 'OK') {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Forward geocode failed');
  }
  const top = r.results?.[0];
  const loc = top?.geometry?.location;
  if (!top || typeof loc?.lat !== 'number' || typeof loc?.lng !== 'number') return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    address: top.formatted_address ?? null,
    googlePlaceId: top.place_id ?? null,
  };
}

export function normalizeDirections(raw: unknown): NormalizedDirections {
  const r = raw as {
    status?: string;
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{ duration?: { value?: number }; distance?: { value?: number } }>;
    }>;
  };
  const route = r.routes?.[0];
  if (r.status !== 'OK' || !route) {
    throw new GoogleApiError(r.status ?? 'UNKNOWN', 'Directions lookup failed');
  }
  const legs = route.legs ?? [];
  return {
    durationSeconds: legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0),
    distanceMeters: legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0),
    polyline: route.overview_polyline?.points ?? '',
  };
}

// --- Fetch wrappers (network injected via globalThis.fetch) -------------------

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new GoogleApiError(`HTTP_${res.status}`, `Google HTTP ${res.status}`);
  }
  return res.json();
}

export interface FetchDetailsInput {
  placeId: string;
  apiKey: string;
  sessionToken?: string;
}

export async function fetchPlaceDetails(input: FetchDetailsInput): Promise<NormalizedDetails> {
  const params = new URLSearchParams({
    place_id: input.placeId,
    fields: DETAILS_FIELDS,
    key: input.apiKey,
  });
  if (input.sessionToken) params.set('sessiontoken', input.sessionToken);
  return normalizeDetails(await getJson(`${DETAILS_URL}?${params.toString()}`));
}

/** Rich Place Details field mask — basic + contact (hours) + atmosphere
 *  (rating/reviews/summary). Costlier SKU, but only ever called from a
 *  user-initiated POI tap on the map. */
const POI_FIELDS =
  'place_id,name,formatted_address,geometry/location,types,photos,rating,user_ratings_total,opening_hours,editorial_summary,reviews';

export async function fetchPoiDetailsRich(input: {
  placeId: string;
  apiKey: string;
}): Promise<NormalizedPoiDetails> {
  const params = new URLSearchParams({
    place_id: input.placeId,
    fields: POI_FIELDS,
    key: input.apiKey,
  });
  return normalizePoiDetails(await getJson(`${DETAILS_URL}?${params.toString()}`));
}

export interface FetchAutocompleteInput {
  input: string;
  apiKey: string;
  sessionToken?: string;
}

/**
 * Server-side Places Autocomplete (uses the server key, so it works even when
 * the browser Maps-JS key is unavailable). The session token bundles these
 * predictions with the eventual Place Details call into one billing session.
 */
export async function fetchPlaceAutocomplete(
  input: FetchAutocompleteInput,
): Promise<AutocompletePrediction[]> {
  const params = new URLSearchParams({ input: input.input, key: input.apiKey });
  if (input.sessionToken) params.set('sessiontoken', input.sessionToken);
  return normalizeAutocomplete(await getJson(`${AUTOCOMPLETE_URL}?${params.toString()}`));
}

export interface FetchReverseGeocodeInput {
  lat: number;
  lng: number;
  apiKey: string;
}

export async function fetchReverseGeocode(input: FetchReverseGeocodeInput): Promise<NormalizedReverseGeocode> {
  const params = new URLSearchParams({
    latlng: `${input.lat},${input.lng}`,
    key: input.apiKey,
  });
  return normalizeReverseGeocode(await getJson(`${GEOCODE_URL}?${params.toString()}`));
}

export interface FetchForwardGeocodeInput {
  address: string;
  apiKey: string;
}

/** Forward-geocode an address string to coordinates; null when Google has no match. */
export async function fetchForwardGeocode(
  input: FetchForwardGeocodeInput,
): Promise<NormalizedForwardGeocode | null> {
  const params = new URLSearchParams({ address: input.address, key: input.apiKey });
  return normalizeForwardGeocode(await getJson(`${GEOCODE_URL}?${params.toString()}`));
}

export interface FetchDirectionsInput {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints: Array<{ lat: number; lng: number }>;
  mode: TravelMode;
  apiKey: string;
}

export async function fetchDirections(input: FetchDirectionsInput): Promise<NormalizedDirections> {
  const params = new URLSearchParams({
    origin: `${input.origin.lat},${input.origin.lng}`,
    destination: `${input.destination.lat},${input.destination.lng}`,
    mode: DIRECTIONS_MODE[input.mode],
    key: input.apiKey,
  });
  if (input.waypoints.length > 0) {
    params.set('waypoints', input.waypoints.map((w) => `${w.lat},${w.lng}`).join('|'));
  }
  return normalizeDirections(await getJson(`${DIRECTIONS_URL}?${params.toString()}`));
}
