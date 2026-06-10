/**
 * Pure data prep for the Plan map (shared by PlanMap.native + PlanMap.web).
 * Mirrors the web app's src/lib/map/markers.ts + polyline.ts: pins are built
 * per layer (day stops / saved / restaurants), route paths are built ONE PER
 * LEG (consecutive plottable pair) keyed by `from|to|mode`, and the viewport
 * fit key tracks base-pin positions only.
 */
import type { Leg, Place, TravelMode } from '../../../lib/api';
import { decodePolyline, type LatLng } from '../../../lib/legView';
import { dayRouteUrl } from '../../../lib/googleMapsUrl';
import { glyph } from '../../../lib/theme';
import type { MapDayGroup, MapRestaurant } from '../PlanMap.types';

/** Teal (Atlas accent) for Saved pins; amber (day-2) for the Restaurants layer. */
export const SAVED_PIN_COLOR = '#33677A';
export const RESTAURANT_PIN_COLOR = '#C99231';
export const RESTAURANT_GLYPH = '🍽️';

/** One plottable pin, provider-agnostic. */
export type MapPin = {
  /** Stable render key (layer-prefixed so overlay pins never collide). */
  key: string;
  kind: 'day' | 'saved' | 'restaurant';
  name: string;
  lat: number;
  lng: number;
  /** Ring/badge color (day color / teal saved / amber restaurant). */
  color: string;
  /** Category emoji centered in the disc. */
  glyph: string;
  /** Stop number ("1".."n", = orderIndex+1) for day stops; null = no badge. */
  label: string | null;
  /** "HH:MM" pill under day pins; null elsewhere. */
  scheduledTime: string | null;
  /** Backing record for tap routing. */
  place?: Place;
  restaurant?: MapRestaurant;
};

/** One tappable route segment (one leg between two consecutive stops). */
export type MapSeg = {
  key: string;
  color: string;
  path: LatLng[];
  fromName: string;
  toName: string;
  mode: TravelMode;
  /** Cached leg (duration/distance/polyline) or null when uncomputed. */
  leg: Leg | null;
};

type Mapped = Place & { lat: number; lng: number };
const isMapped = (p: Place): p is Mapped => typeof p.lat === 'number' && typeof p.lng === 'number';

const byOrder = (a: Place, b: Place) => a.orderIndex - b.orderIndex;

/**
 * Numbered, colored pins for one day group. Labels use `orderIndex + 1` so the
 * map matches the list even when coord-less stops were dropped (never renumber
 * after filtering).
 */
export function buildDayPins(group: MapDayGroup): MapPin[] {
  return group.stops
    .slice()
    .sort(byOrder)
    .filter(isMapped)
    .map((p) => ({
      key: `d-${p.id}`,
      kind: 'day' as const,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      color: group.color,
      glyph: glyph(p.category),
      label: String(p.orderIndex + 1),
      scheduledTime: p.scheduledTime,
      place: p,
    }));
}

/** Un-numbered teal pins (Saved bucket / saved-places layer). */
export function buildSavedPins(places: Place[]): MapPin[] {
  return places
    .slice()
    .sort(byOrder)
    .filter(isMapped)
    .map((p) => ({
      key: `s-${p.id}`,
      kind: 'saved' as const,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      color: SAVED_PIN_COLOR,
      glyph: glyph(p.category),
      label: null,
      scheduledTime: null,
      place: p,
    }));
}

/** Amber 🍽️ pins for the Restaurants layer; coord-less restaurants dropped. */
export function buildRestaurantPins(restaurants: MapRestaurant[]): MapPin[] {
  return restaurants
    .filter((r) => typeof r.lat === 'number' && typeof r.lng === 'number')
    .map((r) => ({
      key: `r-${r.id}`,
      kind: 'restaurant' as const,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      color: RESTAURANT_PIN_COLOR,
      glyph: RESTAURANT_GLYPH,
      label: null,
      scheduledTime: null,
      restaurant: r,
    }));
}

const segLegKey = (fromId: string, toId: string, mode: TravelMode) => `${fromId}|${toId}|${mode}`;

/**
 * One MapSeg per consecutive plottable pair per group. The leg lookup is keyed
 * by `from|to|mode` where mode = destination's `legMode ?? dayModes[date] ??
 * 'drive'` (web buildDayLegPaths semantics). Missing/uncomputed leg → straight
 * 2-point fallback, still tappable (chip shows "—").
 */
export function buildLegSegs(
  groups: MapDayGroup[],
  legs: Leg[],
  dayModes: Record<string, TravelMode>,
): MapSeg[] {
  const byPair = new Map<string, Leg>();
  for (const l of legs) byPair.set(segLegKey(l.fromPlaceId, l.toPlaceId, l.mode), l);

  const out: MapSeg[] = [];
  for (const g of groups) {
    const plottable = g.stops.slice().sort(byOrder).filter(isMapped);
    if (plottable.length < 2) continue;
    const dayDefault: TravelMode = dayModes[g.date] ?? 'drive';
    for (let i = 0; i < plottable.length - 1; i += 1) {
      const from = plottable[i]!;
      const to = plottable[i + 1]!;
      const mode: TravelMode = to.legMode ?? dayDefault;
      const leg = byPair.get(segLegKey(from.id, to.id, mode)) ?? null;
      const decoded = leg?.polyline ? decodePolyline(leg.polyline) : [];
      const path: LatLng[] =
        decoded.length >= 2
          ? decoded
          : [
              { latitude: from.lat, longitude: from.lng },
              { latitude: to.lat, longitude: to.lng },
            ];
      out.push({
        key: `${g.date}:${from.id}->${to.id}`,
        color: g.color,
        path,
        fromName: from.name,
        toName: to.name,
        mode,
        leg,
      });
    }
  }
  return out;
}

export type RouteLink = { date: string; color: string; url: string };

/** Per-visible-day Google Maps directions deep links (skip 0-stop days). */
export function buildRouteLinks(
  groups: MapDayGroup[],
  dayModes: Record<string, TravelMode>,
): RouteLink[] {
  return groups.flatMap((g) => {
    const pts = g.stops
      .slice()
      .sort(byOrder)
      .filter(isMapped)
      .map((p) => ({ lat: p.lat, lng: p.lng, name: p.name, googlePlaceId: p.googlePlaceId }));
    if (pts.length === 0) return [];
    return [{ date: g.date, color: g.color, url: dayRouteUrl(pts, dayModes[g.date] ?? 'drive') }];
  });
}

/** Position key for the fit set: refit ONLY when this changes. */
export function fitKeyFor(pins: MapPin[]): string {
  return pins.map((p) => `${p.lat},${p.lng}`).join('|');
}

export type { MapDayGroup, MapRestaurant };
