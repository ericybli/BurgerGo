/**
 * Server-side Google web-service client. Calls Place Details, Geocoding
 * (reverse), and Directions with the server key and normalizes responses.
 * `fetch` is read from globalThis so tests can stub it; no real key is
 * required to build or test. Every billable call is cache-gated by the
 * proxy route that wraps it.
 */
import type { TravelMode } from '@/src/lib/googleMapsUrl';

const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
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

export type CategoryGuess = 'sightseeing' | 'lodging' | 'transport' | 'activity' | 'other';

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

/** Normalized reverse-geocode result. */
export interface NormalizedReverseGeocode {
  address: string | null;
}

/** Normalized forward-geocode result (address → coords); null when no match. */
export interface NormalizedForwardGeocode {
  lat: number;
  lng: number;
  address: string | null;
}

/** Normalized Directions — summed across legs; polyline written into `travel_legs`. */
export interface NormalizedDirections {
  durationSeconds: number;
  distanceMeters: number;
  polyline: string;
}

function guessCategory(types: string[] | undefined): CategoryGuess {
  const t = new Set(types ?? []);
  if (t.has('lodging')) return 'lodging';
  if (
    t.has('airport') || t.has('train_station') || t.has('subway_station') ||
    t.has('bus_station') || t.has('transit_station')
  ) return 'transport';
  if (
    t.has('tourist_attraction') || t.has('museum') || t.has('place_of_worship') ||
    t.has('park') || t.has('art_gallery')
  ) return 'sightseeing';
  if (
    t.has('amusement_park') || t.has('zoo') || t.has('aquarium') ||
    t.has('stadium') || t.has('spa') || t.has('night_club')
  ) return 'activity';
  return 'other';
}

// --- Pure normalizers (unit-tested directly) ----------------------------------

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
  return { lat: loc.lat, lng: loc.lng, address: top.formatted_address ?? null };
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
