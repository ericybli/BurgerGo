/**
 * Shared client-side types for the Plan▸Map surface. These mirror the
 * RESOLUTIONS §Data shapes served by GET /api/trips/[tripId]/places and
 * passed by B2's PlanClient to PlanMap via props. Helpers import from here;
 * the component imports from here too (not re-defined per file).
 */
import type { TravelMode } from '@/src/lib/googleMapsUrl';

/** Client DTO for a trip place (produced by B1's read handler). */
export interface PlaceDTO {
  id: string;
  tripId: string;
  dayDate: string | null;
  googlePlaceId: string | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  category: 'sightseeing' | 'lodging' | 'transport' | 'activity' | 'other';
  scheduledTime: string | null;
  durationMin: number | null;
  cost: number | null;
  notes: string | null;
  orderIndex: number;
  /** `/api/photos/[googlePlaceId]/card` for Google places; null for map-drop pins. */
  photoPath: string | null;
}

/** Client DTO for a travel leg (produced by B1's read handler). */
export interface LegDTO {
  fromPlaceId: string;
  toPlaceId: string;
  mode: TravelMode;
  durationSeconds: number;
  distanceMeters: number;
  /** Google encoded overview polyline; null when uncomputed / offline. */
  polyline: string | null;
}

/** B2's day-group prop shape passed into PlanMap. */
export interface DayGroup {
  date: string | null;
  dayNumber: number | null;
  /** Index into DAY_COLORS palette; B2 assigns it once and it is stable. */
  colorIndex: number;
  places: PlaceDTO[];
}

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

/** One day's assembled route path with its assigned color. */
export interface DayPath {
  date: string;
  color: string;
  path: LatLngLiteral[];
}
