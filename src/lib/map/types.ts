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
