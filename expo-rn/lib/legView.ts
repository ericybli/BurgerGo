/** Leg + map helpers for the Plan screen. */
import { photoUrl } from './api';
import type { Leg, Place, TravelMode } from './api';

export type LatLng = { latitude: number; longitude: number };

/** Index legs by "from->to" so a day's consecutive stops can look theirs up. */
export function indexLegs(legs: Leg[]): Map<string, Leg> {
  const map = new Map<string, Leg>();
  for (const l of legs) map.set(`${l.fromPlaceId}->${l.toPlaceId}`, l);
  return map;
}

export function legBetween(map: Map<string, Leg>, fromId: string, toId: string): Leg | undefined {
  return map.get(`${fromId}->${toId}`);
}

/** All distances display in miles (web parity), one decimal: "3.2 mi". */
export function formatDistance(meters: number): string {
  return `${(Math.round((meters / 1609.344) * 10) / 10).toFixed(1)} mi`;
}

/** Web-parity leg line: "🚗 5 min · 3.2 mi". */
export function formatLeg(leg: Leg): string {
  return `${MODE_GLYPH[leg.mode]} ${formatDuration(leg.durationSeconds)} · ${formatDistance(leg.distanceMeters)}`;
}

/** Web-parity duration: ALWAYS minutes, floored at 1 ("65 min", never "1 h 5 min" or "0 min"). */
export function formatDuration(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export const MODE_GLYPH: Record<TravelMode, string> = {
  walk: '🚶',
  drive: '🚗',
  transit: '🚆',
};

/** Per-day default travel mode when a day has no explicit row (mirrors web). */
export const DEFAULT_DAY_MODE: TravelMode = 'drive';

/** Google Maps deep-link for a single place (coords preferred, else name). */
export function placeMapsUrl(p: { name: string; lat: number | null; lng: number | null }): string {
  if (p.lat != null && p.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.name)}`;
}

/** Thumbnail URL for a place (personal photo → cached Google photo → none). */
export function thumbForPlace(place: Place, size: 'thumb' | 'card' | 'full' = 'card'): string | null {
  const first = place.photos[0];
  if (first) return photoUrl.personal(first.id, size);
  if (place.photoPath != null) return photoUrl.place(place.id, size);
  return null;
}

/** Atlas day pin/route palette (Day 1–4, cycling — mirrors web). */
export { DAY_COLORS } from './theme';
import { DAY_COLORS as ATLAS_DAY_COLORS } from './theme';

/** 0-based day index → its Atlas day color. */
export function dayColor(dayIndex: number): string {
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return ATLAS_DAY_COLORS[0]!;
  return ATLAS_DAY_COLORS[Math.floor(dayIndex) % ATLAS_DAY_COLORS.length]!;
}

/** Decode a Google-encoded polyline string into lat/lng coordinates. */
export function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}

/** Region that fits all the given coordinates with some padding. */
export function regionForCoords(coords: LatLng[]): {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
} | null {
  if (coords.length === 0) return null;
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLng = Math.min(minLng, c.longitude);
    maxLng = Math.max(maxLng, c.longitude);
  }
  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max((maxLat - minLat) * 1.4, 0.02);
  const longitudeDelta = Math.max((maxLng - minLng) * 1.4, 0.02);
  return { latitude, longitude, latitudeDelta, longitudeDelta };
}
