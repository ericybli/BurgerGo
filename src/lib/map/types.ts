/**
 * Shared client-side types for the Plan▸Map surface. These mirror the
 * RESOLUTIONS §Data shapes served by GET /api/trips/[tripId]/places and
 * passed by B2's PlanClient to PlanMap via props. Helpers import from here;
 * the component imports from here too (not re-defined per file).
 *
 * PlaceDTO and LegDTO are canonical in planView.ts; DayGroup is canonical in
 * planUrl.ts. This file re-exports them so map helpers can import from one
 * consistent place without redefining shapes.
 */
export type { PlaceDTO, LegDTO } from '@/src/lib/planView';
export type { DayGroup } from '@/src/lib/planUrl';
import type { LegDTO } from '@/src/lib/planView';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

/** One day's assembled route path with its assigned color. */
export interface DayPath {
  date: string;
  color: string;
  path: LatLngLiteral[];
  /**
   * Present when this path is a SINGLE leg (buildDayLegPaths): tap metadata
   * for the map's leg-info chip. `leg` is null when the leg hasn't been
   * computed yet (straight-line fallback) — the chip shows the placeholder.
   */
  seg?: {
    fromName: string;
    toName: string;
    leg: LegDTO | null;
  };
}
