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
  /** Prefer this exact-POI id; null/undefined → fall back to a name search. */
  googlePlaceId?: string | null;
  /** Disambiguates the name search when there's no place id (street, city). */
  address?: string | null;
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
 * "Open in Google Maps" for a single place. Prefers `googlePlaceId` (exact POI
 * — Google opens the place card with its name + photos). With no place id, a
 * name (disambiguated by address) is used as the search `query` so Google still
 * resolves the real place rather than dropping a bare coordinate pin. Only a
 * truly nameless map-drop pin falls back to coordinates.
 */
export function placeUrl(input: PlaceUrlInput): string {
  const params = new URLSearchParams({ api: '1' });
  if (input.googlePlaceId) {
    params.set('query', input.name);
    params.set('query_place_id', input.googlePlaceId);
  } else {
    const name = input.name?.trim();
    const address = input.address?.trim();
    if (name && address) {
      params.set('query', `${name}, ${address}`);
    } else if (name) {
      params.set('query', name);
    } else if (address) {
      params.set('query', address);
    } else {
      params.set('query', coordStr(input));
    }
  }
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

/** One day-route stop: coordinates plus (when known) the Google POI identity. */
export interface RouteStop extends LatLng {
  name?: string | null;
  googlePlaceId?: string | null;
}

/** Stop text for the directions URL: the place NAME when an exact place id
 *  pins it down (Google then shows the real place with its name/photos),
 *  otherwise precise coordinates. */
function stopStr(s: RouteStop): string {
  return s.googlePlaceId && s.name?.trim() ? s.name.trim() : coordStr(s);
}

/**
 * Multi-stop day-route deep link. Origin = first stop, destination = last
 * stop, intermediate stops as ordered pipe-separated `waypoints`, plus the
 * day's `travelmode`. Stops carrying a `googlePlaceId` are passed as real
 * Google places (name + `*_place_id` params) so the Maps app shows named
 * places with photos instead of bare coordinate pins; id-less stops fall back
 * to coordinates. Constructible offline from cached `places` rows.
 */
export function dayRouteUrl(orderedPlaces: RouteStop[], mode: TravelMode): string {
  if (orderedPlaces.length === 0) {
    throw new Error('dayRouteUrl requires at least one stop');
  }
  const first = orderedPlaces[0]!;
  const last = orderedPlaces[orderedPlaces.length - 1]!;
  const intermediate = orderedPlaces.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin: stopStr(first),
    destination: stopStr(last),
    travelmode: MODE_PARAM[mode],
  });
  if (first.googlePlaceId) params.set('origin_place_id', first.googlePlaceId);
  if (last.googlePlaceId) params.set('destination_place_id', last.googlePlaceId);
  if (intermediate.length > 0) {
    // `waypoint_place_ids` must correspond 1:1 with `waypoints`, so place ids
    // are only sent when EVERY intermediate stop has one; otherwise id-less
    // stops use precise coordinates as their text.
    const allHaveIds = intermediate.every((s) => !!s.googlePlaceId);
    params.set(
      'waypoints',
      intermediate.map((s) => (allHaveIds ? stopStr(s) : coordStr(s))).join('|'),
    );
    if (allHaveIds) {
      params.set('waypoint_place_ids', intermediate.map((s) => s.googlePlaceId!).join('|'));
    }
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
