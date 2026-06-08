/**
 * Plan-tab DTO shapes + pure data-prep (spec §3.3–§3.5). No React, no fetch,
 * no Google. The Plan UI client-fetches `{ places, legs }` from
 * `GET /api/trips/[tripId]/places`; these helpers bucket the flat `PlaceDTO[]`
 * by day / Saved, keep each bucket ordered by `orderIndex`, and assign stable
 * per-day color indexes + pin labels (`orderIndex + 1`).
 */
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { DAY_COLORS, colorForIndex } from '@/src/lib/map/colors';
export { DAY_COLORS } from '@/src/lib/map/colors';

/**
 * One place as returned by the B1 read handler. Structural superset of the
 * relevant `places` columns plus `photoPath` (the cached Google card photo, or
 * null → fall back to the category glyph).
 */
export interface PlaceDTO {
  id: string;
  tripId: string;
  dayDate: string | null; // null = Saved bucket
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category:
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
  scheduledTime: string | null; // HH:MM
  durationMin: number | null;
  cost: number | null; // minor units
  notes: string | null;
  /** Mode of the leg arriving at this place (from the previous stop); null → follow the day default. */
  legMode: TravelMode | null;
  /** Saved-bucket grouping: the saved list this place is in, or null = "loose". */
  listId: string | null;
  orderIndex: number; // 0-based; pin label = orderIndex + 1
  photoPath: string | null; // place_details_cache.photoLocalPath, else null
  /** Personal photos for this place, ordered (Plan 2). First wins for the card thumb. */
  photos: { id: string; width: number | null; height: number | null }[];
  /** AI-generated intro (editable); null until generated. */
  aiSummary: string | null;
  /** Travel-guide links attached to this place (newest first). */
  links: { id: string; url: string; title: string | null; thumbnail: string | null }[];
}

/** A saved-place grouping list (slim, client-facing). */
export interface SavedListItem {
  id: string;
  name: string;
}

/** One cached travel leg as returned by the B1 read handler. */
export interface LegDTO {
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  polyline: string | null;
}

export type DayColor = string;

const byOrder = (a: PlaceDTO, b: PlaceDTO) => a.orderIndex - b.orderIndex;

/** Stable palette index for a 0-based day index; clamps/cycles, never NaN. */
export function colorIndexForDay(dayIndex: number): number {
  if (!Number.isFinite(dayIndex) || dayIndex < 0) return 0;
  return Math.floor(dayIndex) % DAY_COLORS.length;
}

/** Stable color for a 0-based day index; clamps/cycles, never undefined. */
export function dayColor(dayIndex: number): DayColor {
  return colorForIndex(colorIndexForDay(dayIndex));
}

/** Displayed pin number for a place (spec §5.8: `orderIndex + 1`). */
export function pinLabel(place: PlaceDTO): number {
  return place.orderIndex + 1;
}

/** All places on a given dayDate, ordered by orderIndex. */
export function placesForDay(places: PlaceDTO[], dayDate: string): PlaceDTO[] {
  return places.filter((p) => p.dayDate === dayDate).sort(byOrder);
}

/** The Saved bucket (dayDate = null), ordered by orderIndex. */
export function savedPlaces(places: PlaceDTO[]): PlaceDTO[] {
  return places.filter((p) => p.dayDate === null).sort(byOrder);
}

/** Map of dayDate → ordered places. Saved (null) rows are excluded. */
export function bucketByDay(places: PlaceDTO[]): Record<string, PlaceDTO[]> {
  const out: Record<string, PlaceDTO[]> = {};
  for (const p of places) {
    if (p.dayDate === null) continue;
    (out[p.dayDate] ??= []).push(p);
  }
  for (const date of Object.keys(out)) out[date]!.sort(byOrder);
  return out;
}
