/**
 * Pure data-prep for per-leg travel chips (spec §3.4) and the Today next-stop
 * pointer (spec §3.6). No React, no fetch, no Google — the Plan UI passes in the
 * `LegDTO[]` it fetched and a wall-clock "HH:MM" string. Stops are assumed
 * already ordered by `orderIndex`.
 */
import type { LegDTO, PlaceDTO } from '@/src/lib/planView';
import type { TravelMode } from '@/src/lib/googleMapsUrl';

/** O(1) cached-leg lookup keyed by `${fromId}|${toId}|${mode}`. */
export type LegLookup = Map<string, LegDTO>;

const MODE_GLYPH: Record<TravelMode, string> = {
  walk: '🚶',
  drive: '🚗',
  transit: '🚆',
};

/** Canonical placeholder for an uncomputed/unavailable leg (spec §3.4). */
export const LEG_PLACEHOLDER = '—';

function key(fromId: string, toId: string, mode: string): string {
  return `${fromId}|${toId}|${mode}`;
}

/** Build a lookup map from a flat list of cached legs. */
export function indexLegs(legs: LegDTO[]): LegLookup {
  const map: LegLookup = new Map();
  for (const l of legs) map.set(key(l.fromPlaceId, l.toPlaceId, l.mode), l);
  return map;
}

/** Cached leg for an ordered pair + mode, or undefined on a miss. */
export function legBetween(
  lookup: LegLookup,
  fromId: string,
  toId: string,
  mode: TravelMode,
): LegDTO | undefined {
  return lookup.get(key(fromId, toId, mode));
}

/** "🚶 12 min · 0.6 mi" for a leg, or the canonical `—` when absent. */
export function formatLeg(leg: LegDTO | undefined): string {
  if (!leg) return LEG_PLACEHOLDER;
  const minutes = Math.max(1, Math.round(leg.durationSeconds / 60));
  // Distances display in miles (1 mi = 1609.344 m), rounded to 1 decimal.
  const miles = (Math.round((leg.distanceMeters / 1609.344) * 10) / 10).toFixed(1);
  return `${MODE_GLYPH[leg.mode]} ${minutes} min · ${miles} mi`;
}

/**
 * Transient next-stop selection (spec §3.6): the first stop (in order) whose
 * `scheduledTime` is strictly after `nowHHMM`; if none, stop 0; -1 if empty.
 */
export function nextStopIndex(orderedStops: readonly PlaceDTO[], nowHHMM: string): number {
  if (orderedStops.length === 0) return -1;
  const idx = orderedStops.findIndex((s) => s.scheduledTime !== null && s.scheduledTime > nowHHMM);
  return idx === -1 ? 0 : idx;
}
