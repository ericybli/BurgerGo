/**
 * Plan-local REST calls that the shared lib/api client doesn't expose (the
 * shared client is frozen for this section). Each mirrors the parity spec's
 * API table; the leg-mode / list / summary routes are spec items 19/20/22
 * ("NEW") — calls fail gracefully until the backend ships them.
 */
import { getJson, writeJson } from '../../lib/api/client';
import type { Place, TravelMode } from '../../lib/api';

const enc = encodeURIComponent;

/** Per-leg travel-mode override: sets the mode of the leg arriving at `placeId`. */
export function setLegMode(tripId: string, placeId: string, mode: TravelMode) {
  return writeJson<{ place: Place }>('PUT', `/api/trips/${tripId}/places/${placeId}/leg-mode`, { mode });
}

/** Move a saved place into a list (or out of any list with null = "loose"). */
export function setPlaceList(tripId: string, placeId: string, listId: string | null) {
  return writeJson<{ place: Place }>('PUT', `/api/trips/${tripId}/places/${placeId}/list`, { listId });
}

/** (Re)generate a place's AI About summary; returns the updated place. */
export function generateSummary(tripId: string, placeId: string) {
  return writeJson<{ place: Place | null }>('POST', `/api/trips/${tripId}/places/${placeId}/summary`);
}

// --- Google proxies -----------------------------------------------------------

export type PlaceDetailsLite = {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  categoryGuess: string | null;
};

/**
 * Place Details via the server proxy. The live route returns a FLAT object
 * (see app/api/google/details/route.ts); the shared client types it wrapped —
 * normalize both shapes here. Also caches the place photo server-side.
 */
export async function placeDetails(placeId: string, sessionToken?: string): Promise<PlaceDetailsLite | null> {
  try {
    const raw = await getJson<Record<string, unknown>>(
      `/api/google/details?placeId=${enc(placeId)}${sessionToken ? `&sessionToken=${enc(sessionToken)}` : ''}`,
    );
    const d = (raw && typeof raw === 'object' && 'details' in raw ? raw.details : raw) as
      | Record<string, unknown>
      | null;
    if (!d || typeof d.googlePlaceId !== 'string') return null;
    return {
      googlePlaceId: d.googlePlaceId,
      name: typeof d.name === 'string' ? d.name : null,
      address: typeof d.address === 'string' ? d.address : null,
      lat: typeof d.lat === 'number' ? d.lat : null,
      lng: typeof d.lng === 'number' ? d.lng : null,
      categoryGuess: typeof d.categoryGuess === 'string' ? d.categoryGuess : null,
    };
  } catch {
    return null;
  }
}

export type ForwardGeocodeResult = {
  lat: number;
  lng: number;
  address: string | null;
  googlePlaceId: string | null;
};

/** Best-effort forward geocode of a hand-typed address (null when no match). */
export async function forwardGeocode(address: string): Promise<ForwardGeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const data = await getJson<{
      lat: number | null;
      lng: number | null;
      address: string | null;
      googlePlaceId?: string | null;
    }>(`/api/google/geocode?address=${enc(trimmed)}`);
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return { lat: data.lat, lng: data.lng, address: data.address, googlePlaceId: data.googlePlaceId ?? null };
  } catch {
    return null;
  }
}

// --- Place guide links ----------------------------------------------------------

/** Create a guide link attached to a place (shared client omits `placeId`). */
export function addPlaceLink(
  tripId: string,
  body: { placeId: string; url: string; title: string | null; thumbnail: string | null },
) {
  return writeJson<{ link: { id: string } }>('POST', `/api/trips/${tripId}/links`, body);
}
