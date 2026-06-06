/**
 * Pure viewport math for the Plan▸Map view (spec §3.4).
 * `computeBounds` returns a plain literal the thin map component passes to
 * `google.maps.LatLngBounds` for `fitBounds`. A lone point gets a small
 * padded box (~1.1 km) to avoid over-zoom to street level.
 */
import type { LatLngLiteral } from '@/src/lib/map/types';

export interface BoundsLiteral {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Degrees of pad applied around a lone point (~1.1 km at equator). */
const SINGLE_POINT_PAD = 0.01;

/** Tight bounding box over the given points, or null when there are none. */
export function computeBounds(points: LatLngLiteral[]): BoundsLiteral | null {
  if (points.length === 0) return null;

  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;

  for (const p of points) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }

  if (south === north && west === east) {
    return {
      south: south - SINGLE_POINT_PAD,
      north: north + SINGLE_POINT_PAD,
      west: west - SINGLE_POINT_PAD,
      east: east + SINGLE_POINT_PAD,
    };
  }
  return { south, west, north, east };
}

/** Geometric center of a bounds literal. */
export function boundsCenter(b: BoundsLiteral): LatLngLiteral {
  return { lat: (b.south + b.north) / 2, lng: (b.west + b.east) / 2 };
}
