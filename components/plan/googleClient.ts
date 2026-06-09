/**
 * Client-side Google wrappers (spec §6.1/§6.5). All Google network calls go
 * through the server proxies (/api/google/*) so the server key is never
 * exposed to the browser and all calls are cache-gated.
 */
import { withBase } from '@/src/lib/basePath';

/**
 * Reverse-geocode a lat/lng to a human-readable address via the server proxy.
 * Returns null on a zero-result, network failure, or missing key.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(withBase(`/api/google/geocode?lat=${lat}&lng=${lng}`));
    if (!res.ok) return null;
    const data = (await res.json()) as { address: string | null };
    return data.address;
  } catch {
    return null;
  }
}

export interface ForwardGeocodeResult {
  lat: number;
  lng: number;
  address: string | null;
  /** Google place id of the match, when present (drives photo/name auto-fill). */
  googlePlaceId: string | null;
}

export interface PoiDetails {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  categoryGuess: string | null;
}

/**
 * Place Details for a tapped basemap POI via the server proxy (cache-gated,
 * server key; also caches the place photo server-side). Standalone lookup —
 * no autocomplete session token. Returns null on failure.
 */
export async function fetchPoiDetails(placeId: string): Promise<PoiDetails | null> {
  try {
    const res = await fetch(
      withBase(`/api/google/details?placeId=${encodeURIComponent(placeId)}`),
      { credentials: 'same-origin' },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PoiDetails>;
    return {
      googlePlaceId: data.googlePlaceId ?? placeId,
      name: data.name ?? null,
      address: data.address ?? null,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lng: typeof data.lng === 'number' ? data.lng : null,
      categoryGuess: data.categoryGuess ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Forward-geocode a free-text address to coordinates via the server proxy.
 * Returns null on no-match, network failure, or missing key — callers save the
 * place without coordinates in that case.
 */
export async function forwardGeocode(address: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(withBase(`/api/google/geocode?address=${encodeURIComponent(trimmed)}`));
    if (!res.ok) return null;
    const data = (await res.json()) as { lat: number | null; lng: number | null; address: string | null; googlePlaceId?: string | null };
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return { lat: data.lat, lng: data.lng, address: data.address, googlePlaceId: data.googlePlaceId ?? null };
  } catch {
    return null;
  }
}
