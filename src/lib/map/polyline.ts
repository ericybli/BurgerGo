/**
 * Encoded-polyline decoder + per-day route path assembler (spec §3.4).
 * We ship our own decoder so paths render without the google.maps geometry
 * library and fall back to straight stop-to-stop segments when a leg's
 * polyline is missing (offline / not yet computed).
 */
import type { DayGroup, LegDTO, DayPath, LatLngLiteral } from '@/src/lib/map/types';
import type { TravelMode } from '@/src/lib/googleMapsUrl';
import { colorForGroup } from '@/src/lib/map/colors';

/**
 * Decode a Google "Encoded Polyline Algorithm Format" string.
 * Precision is e5 (5 decimal places). Values are rounded to 6 decimal
 * places to avoid binary float drift against reference vectors.
 */
export function decodePolyline(encoded: string): LatLngLiteral[] {
  const points: LatLngLiteral[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const len = encoded.length;

  while (index < len) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: Math.round(lat * 1e-5 * 1e6) / 1e6,
      lng: Math.round(lng * 1e-5 * 1e6) / 1e6,
    });
  }
  return points;
}

function legKey(fromId: string, toId: string, mode: TravelMode): string {
  return `${fromId}|${toId}|${mode}`;
}

function hasCoords(p: { lat: number | null; lng: number | null }): boolean {
  return typeof p.lat === 'number' && typeof p.lng === 'number';
}

/**
 * Assemble each day's ordered route path.
 * - Places are sorted by orderIndex; those without coordinates are dropped.
 * - For each consecutive plottable pair: use the decoded leg polyline when
 *   present; fall back to a straight 2-point segment otherwise.
 * - Days with fewer than two plottable stops produce no path.
 * - The shared vertex between consecutive segments is deduplicated.
 * - Only legs whose `mode` matches `mode` are used; non-matching pairs fall
 *   back to the straight line. This mirrors `legView.indexLegs`/`legBetween`.
 */
export function buildDayPaths(groups: DayGroup[], legs: LegDTO[], mode: TravelMode): DayPath[] {
  const byPair = new Map<string, LegDTO>();
  for (const leg of legs) {
    byPair.set(legKey(leg.fromPlaceId, leg.toPlaceId, leg.mode), leg);
  }

  const result: DayPath[] = [];

  for (const group of groups) {
    if (!group.date) continue;

    const plottable = group.places
      .slice()
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .filter(hasCoords) as Array<{ id: string; lat: number; lng: number }>;

    if (plottable.length < 2) continue;

    const path: LatLngLiteral[] = [];
    for (let i = 0; i < plottable.length - 1; i += 1) {
      const from = plottable[i]!;
      const to = plottable[i + 1]!;
      const leg = byPair.get(legKey(from.id, to.id, mode));
      const decoded = leg?.polyline ? decodePolyline(leg.polyline) : [];
      const segment =
        decoded.length >= 2
          ? decoded
          : [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }];

      for (const pt of segment) {
        const last = path[path.length - 1];
        if (last && last.lat === pt.lat && last.lng === pt.lng) continue;
        path.push(pt);
      }
    }

    result.push({ date: group.date, color: colorForGroup(group), path });
  }

  return result;
}
