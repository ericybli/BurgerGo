import { describe, it, expect } from 'vitest';
import { decodePolyline, buildDayPaths } from '@/src/lib/map/polyline';
import type { DayGroup, LegDTO } from '@/src/lib/map/types';

// Minimal PlaceDTO stubs (only lat/lng/id/orderIndex used by path assembly).
function p(id: string, orderIndex: number, lat: number, lng: number) {
  return { id, orderIndex, lat, lng, name: id, category: 'other' as const,
           tripId: 't', dayDate: '2026-06-04', googlePlaceId: null,
           address: null, scheduledTime: null, durationMin: null, cost: null,
           notes: null, photoPath: null };
}

function group(date: string, places: ReturnType<typeof p>[], colorIndex = 0): DayGroup {
  return { date, dayNumber: 1, colorIndex, places };
}

describe('decodePolyline', () => {
  it('decodes the canonical Google reference string', () => {
    // From Google's "Encoded Polyline Algorithm Format" docs.
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(pts).toEqual([
      { lat: 38.5,   lng: -120.2   },
      { lat: 40.7,   lng: -120.95  },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('returns an empty array for an empty string', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('buildDayPaths', () => {
  const g = group('2026-06-04', [
    p('a', 0, 38.5,   -120.2),
    p('b', 1, 40.7,   -120.95),
  ]);

  it('uses a leg polyline for the segment between two stops', () => {
    const legs: LegDTO[] = [
      { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 0, distanceMeters: 0,
        polyline: '_p~iF~ps|U_ulLnnqC' },
    ];
    const paths = buildDayPaths([g], legs);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.date).toBe('2026-06-04');
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
  });

  it('falls back to a straight segment when the leg polyline is null', () => {
    const paths = buildDayPaths([g], []); // no legs
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
  });

  it('falls back per-segment when only some legs have a polyline', () => {
    const g3 = group('2026-06-04', [
      p('a', 0, 38.5,   -120.2),
      p('b', 1, 40.7,   -120.95),
      p('c', 2, 43.252, -126.453),
    ]);
    const legs: LegDTO[] = [
      { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 0, distanceMeters: 0,
        polyline: '_p~iF~ps|U_ulLnnqC' },
      // b→c has no polyline (null)
      { fromPlaceId: 'b', toPlaceId: 'c', mode: 'walk',
        durationSeconds: 0, distanceMeters: 0, polyline: null },
    ];
    const paths = buildDayPaths([g3], legs);
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,   lng: -120.2   }, // a (from decoded a→b)
      { lat: 40.7,   lng: -120.95  }, // b (from decoded a→b)
      { lat: 43.252, lng: -126.453 }, // c (straight fallback b→c)
    ]);
  });

  it('produces no path for a day with fewer than two plottable stops', () => {
    const single = group('2026-06-04', [p('only', 0, 1, 2)]);
    expect(buildDayPaths([single], [])).toEqual([]);
  });

  it('skips stops without coordinates (cannot plot them)', () => {
    const g2 = group('2026-06-04', [
      { ...p('a', 0, 35.0, 139.0) },
      { ...p('b', 1, 0, 0), lat: null as unknown as number, lng: null as unknown as number },
      { ...p('c', 2, 35.1, 139.1) },
    ]);
    // Only a and c are plottable; the path is the straight a→c fallback.
    const paths = buildDayPaths([g2], []);
    expect(paths[0]!.path).toEqual([
      { lat: 35.0, lng: 139.0 },
      { lat: 35.1, lng: 139.1 },
    ]);
  });

  it('ignores legs not matching the day adjacency', () => {
    const legs: LegDTO[] = [
      { fromPlaceId: 'x', toPlaceId: 'y', mode: 'drive',
        durationSeconds: 0, distanceMeters: 0,
        polyline: '_p~iF~ps|U_ulLnnqC' },
    ];
    const paths = buildDayPaths([g], legs);
    // No matching leg → straight fallback.
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
  });
});
