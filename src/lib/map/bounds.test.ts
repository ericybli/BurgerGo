import { describe, it, expect } from 'vitest';
import { computeBounds, boundsCenter } from '@/src/lib/map/bounds';
import type { LatLngLiteral } from '@/src/lib/map/types';

const pts = (xs: [number, number][]): LatLngLiteral[] =>
  xs.map(([lat, lng]) => ({ lat, lng }));

describe('computeBounds', () => {
  it('returns the tight bounding box over multiple points', () => {
    const b = computeBounds(pts([[35.0, 139.0], [36.0, 140.0], [34.5, 139.5]]));
    expect(b).toEqual({ south: 34.5, west: 139.0, north: 36.0, east: 140.0 });
  });

  it('returns a small padded box around a single point (so fitBounds does not over-zoom)', () => {
    const b = computeBounds(pts([[35.0, 139.0]]))!;
    expect(b.south).toBeLessThan(35.0);
    expect(b.north).toBeGreaterThan(35.0);
    expect(b.west).toBeLessThan(139.0);
    expect(b.east).toBeGreaterThan(139.0);
    // The point sits at the box center.
    expect((b.south + b.north) / 2).toBeCloseTo(35.0, 6);
    expect((b.west + b.east) / 2).toBeCloseTo(139.0, 6);
  });

  it('returns null for no points', () => {
    expect(computeBounds([])).toBeNull();
  });
});

describe('boundsCenter', () => {
  it('returns the midpoint of a bounds literal', () => {
    const c = boundsCenter({ south: 34.0, west: 139.0, north: 36.0, east: 141.0 });
    expect(c).toEqual({ lat: 35.0, lng: 140.0 });
  });
});
