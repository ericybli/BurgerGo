/**
 * Pure marker-set builder for the Plan▸Map view (spec §3.4). Converts a
 * B2 DayGroup (already grouped + ordered by PlanClient) into a flat list of
 * PlaceMarker objects the thin map component passes to google.maps.Marker.
 * Places without coordinates are dropped. Labels are 1-based after dropping.
 */
import type { DayGroup, PlaceDTO, LatLngLiteral } from '@/src/lib/map/types';
import { colorForGroup } from '@/src/lib/map/colors';
import { categoryGlyph } from '@/src/lib/planUrl';

/** One plottable pin. */
export interface PlaceMarker {
  id: string;
  name: string;
  category: PlaceDTO['category'];
  googlePlaceId: string | null;
  photoPath: string | null;
  position: LatLngLiteral;
  /** "1".."n" for day stops (Coral text, spec §3.4); null for Saved pins. */
  label: string | null;
  /** Day palette color for day markers; null for Saved markers. */
  color: string | null;
  /** Category icon (emoji) shown on the pin so categories are distinguishable. */
  glyph: string;
  /** Scheduled time (HH:MM) shown beneath day pins; null when unset / non-day. */
  scheduledTime: string | null;
}

/** Teal used for non-day pins (Saved bucket / saved-places layer). */
export const SAVED_PIN_COLOR = '#4F8A86';

/** Amber used for the Restaurants layer, distinct from day + saved pins. */
export const RESTAURANT_PIN_COLOR = '#E8902E';

/** Glyph shown on Restaurants-layer pins. */
export const RESTAURANT_GLYPH = '🍽️';

/** Restaurant shape the Restaurants map layer + its tap info card need. */
export interface RestaurantMarkerInput {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  cuisine: string | null;
  address: string | null;
  notes: string | null;
  /** Cached Google photo path (or null) — drives the tap info-card photo. */
  photoPath: string | null;
  /** Personal uploaded photos (ordered); first wins for the info-card photo. */
  photos: { id: string; width: number | null; height: number | null }[];
}

function hasCoords(p: PlaceDTO): p is PlaceDTO & { lat: number; lng: number } {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/**
 * Build the ordered, numbered, colored markers for one day group.
 * B2 owns the grouping and ordering; this function only drops
 * coord-less places and attaches the color. Labels use `orderIndex + 1`
 * to stay consistent with `planView.pinLabel` used by the list PlaceCard,
 * so a day containing a coord-less place shows the same stop number on
 * both the list and the map.
 */
export function buildMarkers(group: DayGroup): PlaceMarker[] {
  const color = colorForGroup(group);
  return group.places
    .slice()
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .filter(hasCoords)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      googlePlaceId: p.googlePlaceId,
      photoPath: p.photoPath,
      position: { lat: p.lat, lng: p.lng },
      label: String(p.orderIndex + 1),
      color,
      glyph: categoryGlyph(p.category),
      scheduledTime: p.scheduledTime,
    }));
}

/**
 * Build un-numbered, un-colored markers for the Saved bucket.
 * `places` here is the flat list of saved-bucket places from the bucket's
 * single DayGroup (date=null) that B2 passes in for the Saved view.
 */
export function buildSavedMarkers(places: PlaceDTO[]): PlaceMarker[] {
  return places
    .filter(hasCoords)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      googlePlaceId: p.googlePlaceId,
      photoPath: p.photoPath,
      position: { lat: p.lat as number, lng: p.lng as number },
      label: null,
      color: null,
      glyph: categoryGlyph(p.category),
      scheduledTime: null,
    }));
}

/**
 * Build amber, un-numbered markers for the Restaurants layer. Restaurants
 * without coordinates (no address, or geocoding failed) are dropped — they list
 * fine in Eats, they just can't be pinned. Category is fixed to 'other' (the
 * info card shows the dining glyph regardless).
 */
export function buildRestaurantMarkers(restaurants: RestaurantMarkerInput[]): PlaceMarker[] {
  return restaurants
    .filter(
      (r): r is RestaurantMarkerInput & { lat: number; lng: number } =>
        typeof r.lat === 'number' && typeof r.lng === 'number',
    )
    .map((r) => ({
      id: r.id,
      name: r.name,
      category: 'other',
      googlePlaceId: r.googlePlaceId,
      photoPath: r.photoPath,
      position: { lat: r.lat, lng: r.lng },
      label: null,
      color: RESTAURANT_PIN_COLOR,
      glyph: RESTAURANT_GLYPH,
      scheduledTime: null,
    }));
}
