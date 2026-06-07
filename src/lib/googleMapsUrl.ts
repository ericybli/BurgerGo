/**
 * Google Maps Universal URL builders (spec §6.4). These are plain URLs —
 * no API call, no key, constructible **offline** from cached `places` rows.
 * Tapping one hands off to the native Google Maps app.
 */

/** Internal per-day travel mode (matches `travel_legs.mode`). */
export type TravelMode = 'walk' | 'drive' | 'transit';

/** Fallback day travel mode when a day has no stored override (day_modes). */
export const DEFAULT_DAY_MODE: TravelMode = 'drive';

/** Explicit enum → Google `travelmode` param mapping (never pass the raw enum). */
const MODE_PARAM: Record<TravelMode, string> = {
  walk: 'walking',
  drive: 'driving',
  transit: 'transit',
};

export interface PlaceUrlInput {
  name: string;
  lat: number;
  lng: number;
  /** Prefer this exact-POI id; null/undefined → fall back to coords. */
  googlePlaceId?: string | null;
}

/** A latitude/longitude pair, as stored on a `places` row. */
export interface LatLng {
  lat: number;
  lng: number;
}

function coordStr(p: LatLng): string {
  return `${p.lat},${p.lng}`;
}

/**
 * "Open in Google Maps" for a single place. Prefers `googlePlaceId`
 * (exact POI, human-readable `query` label); falls back to coordinates
 * for map-drop pins that lack a place id.
 */
export function placeUrl(input: PlaceUrlInput): string {
  const params = new URLSearchParams({ api: '1' });
  if (input.googlePlaceId) {
    params.set('query', input.name);
    params.set('query_place_id', input.googlePlaceId);
  } else {
    params.set('query', coordStr(input));
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/**
 * Multi-stop day-route deep link. Origin = first stop, destination = last
 * stop, intermediate stops as ordered pipe-separated `waypoints`, plus the
 * day's `travelmode`. Coordinates come straight from cached `places` rows in
 * `order_index` sequence, so the link is constructible offline.
 */
export function dayRouteUrl(orderedPlaces: LatLng[], mode: TravelMode): string {
  if (orderedPlaces.length === 0) {
    throw new Error('dayRouteUrl requires at least one stop');
  }
  const first = orderedPlaces[0]!;
  const last = orderedPlaces[orderedPlaces.length - 1]!;
  const intermediate = orderedPlaces.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: coordStr(first),
    destination: coordStr(last),
    travelmode: MODE_PARAM[mode],
  });
  if (intermediate.length > 0) {
    params.set('waypoints', intermediate.map(coordStr).join('|'));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
