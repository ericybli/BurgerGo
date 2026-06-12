/**
 * Eats-local Google helpers (RN port of web `useGooglePlaces` / `googleClient`).
 * Lives inside screens/eats because lib/ is owned elsewhere:
 * - `usePlacesAutocomplete`: one UUID session token per search→select billing
 *   cycle (rotated on select success / clear), server-proxied endpoints.
 * - `fetchDetailsFlat`: GET /api/google/details returns a FLAT object (not
 *   `{details}` — the lib/api wrapper type is inaccurate, so we fetch raw).
 * - `forwardGeocode`: best-effort address → coords; null on no-match/failure.
 * - `fetchPoiLive`: live open-now + hours for the detail sheet (null on fail).
 * - small pure helpers: stored-hours parse, thumb precedence, long weekday.
 */
import { useCallback, useRef, useState } from 'react';
import { api, API_BASE, photoUrl, type AutocompletePrediction, type Restaurant } from '../../lib/api';
import { sessionCookie } from '../../lib/auth';

const enc = encodeURIComponent;

/** Tiny UUID v4 (crypto.randomUUID is unavailable under Hermes). */
export function uuid4(): string {
  let out = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += '-';
    else if (i === 14) out += '4';
    else if (i === 19) out += (8 + Math.floor(Math.random() * 4)).toString(16);
    else out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

/** Flat response of GET /api/google/details (subset the form needs). */
export type PlaceDetailsFlat = {
  googlePlaceId: string;
  name: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

async function fetchDetailsFlat(placeId: string, sessionToken: string): Promise<PlaceDetailsFlat | null> {
  try {
    const cookie = sessionCookie();
    const res = await fetch(
      `${API_BASE}/api/google/details?placeId=${enc(placeId)}&sessionToken=${enc(sessionToken)}`,
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<PlaceDetailsFlat>;
    return {
      googlePlaceId: typeof data.googlePlaceId === 'string' ? data.googlePlaceId : placeId,
      name: typeof data.name === 'string' ? data.name : null,
      address: typeof data.address === 'string' ? data.address : null,
      lat: typeof data.lat === 'number' ? data.lat : null,
      lng: typeof data.lng === 'number' ? data.lng : null,
    };
  } catch {
    return null;
  }
}

export type UsePlacesAutocompleteResult = {
  predictions: AutocompletePrediction[];
  search: (input: string) => Promise<void>;
  select: (placeId: string) => Promise<PlaceDetailsFlat | null>;
  clear: () => void;
};

export function usePlacesAutocomplete(): UsePlacesAutocompleteResult {
  const [predictions, setPredictions] = useState<AutocompletePrediction[]>([]);
  const sessionTokenRef = useRef<string>(uuid4());
  const rotate = () => {
    sessionTokenRef.current = uuid4();
  };

  const search = useCallback(async (input: string) => {
    const value = input.trim();
    if (!value) {
      setPredictions([]);
      return;
    }
    try {
      const data = await api.google.autocomplete(value, sessionTokenRef.current);
      setPredictions(data.predictions ?? []);
    } catch {
      // Offline / endpoint failure → no suggestions (web degrades the same way).
      setPredictions([]);
    }
  }, []);

  const select = useCallback(async (placeId: string): Promise<PlaceDetailsFlat | null> => {
    const details = await fetchDetailsFlat(placeId, sessionTokenRef.current);
    if (details) rotate(); // session complete → next search starts fresh
    return details;
  }, []);

  const clear = useCallback(() => {
    setPredictions([]);
    rotate();
  }, []);

  return { predictions, search, select, clear };
}

export type GeocodeResult = {
  lat: number;
  lng: number;
  address: string | null;
  googlePlaceId: string | null;
};

/** Forward-geocode free text. Null on no-match, network failure, or 502. */
export async function forwardGeocode(address: string): Promise<GeocodeResult | null> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const cookie = sessionCookie();
    const res = await fetch(
      `${API_BASE}/api/google/geocode?address=${enc(trimmed)}`,
      cookie ? { headers: { Cookie: cookie } } : undefined,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat: number | null;
      lng: number | null;
      address: string | null;
      googlePlaceId?: string | null;
    };
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return { lat: data.lat, lng: data.lng, address: data.address, googlePlaceId: data.googlePlaceId ?? null };
  } catch {
    return null;
  }
}

export type LiveHours = { openNow: boolean | null; hours: string[] };

/** Live POI open-now + hours; failures swallowed (stored data is the fallback). */
export async function fetchPoiLive(placeId: string): Promise<LiveHours | null> {
  try {
    const d = await api.google.poi(placeId);
    return {
      openNow: typeof d.openNow === 'boolean' ? d.openNow : null,
      hours: Array.isArray(d.hours) ? d.hours : [],
    };
  } catch {
    return null;
  }
}

/** Stored `googleHours` is a JSON string[]; malformed JSON → []. */
export function parseStoredHours(googleHours: string | null): string[] {
  if (!googleHours) return [];
  try {
    const parsed = JSON.parse(googleHours) as unknown;
    return Array.isArray(parsed) ? parsed.filter((l): l is string => typeof l === 'string') : [];
  } catch {
    return [];
  }
}

/** Thumb precedence (web `thumbForRestaurant`): personal → cached Google → none. */
export function restaurantThumb(
  restaurant: Restaurant,
  size: 'thumb' | 'card' | 'full' = 'card',
): string | null {
  const first = restaurant.photos[0];
  if (first) return photoUrl.personal(first.id, size);
  if (restaurant.photoPath != null) return photoUrl.restaurant(restaurant.id, size);
  return null;
}

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** English long weekday for a YYYY-MM-DD date, UTC-stable (web day picker). */
export function longWeekday(dateStr: string): string {
  return WEEKDAYS_LONG[new Date(`${dateStr}T00:00:00Z`).getUTCDay()] ?? '';
}
