import { describe, it, expect } from 'vitest';
import { decodePolyline, buildDayPaths } from '@/src/lib/map/polyline';
import type { DayGroup, LegDTO } from '@/src/lib/map/types';

// Minimal PlaceDTO stubs (only lat/lng/id/orderIndex used by path assembly).
function p(id: string, orderIndex: number, lat: number, lng: number) {
  return { id, orderIndex, lat, lng, name: id, category: 'other' as const,
           tripId: 't', dayDate: '2026-06-04', googlePlaceId: null,
           address: null, scheduledTime: null, durationMin: null, cost: null,
           notes: null, photoPath: null, photos: [] };
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
    const paths = buildDayPaths([g], legs, 'walk');
    expect(paths).toHaveLength(1);
    expect(paths[0]!.date).toBe('2026-06-04');
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
  });

  it('falls back to a straight segment when the leg polyline is null', () => {
    const paths = buildDayPaths([g], [], 'walk'); // no legs
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
    const paths = buildDayPaths([g3], legs, 'walk');
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,   lng: -120.2   }, // a (from decoded a→b)
      { lat: 40.7,   lng: -120.95  }, // b (from decoded a→b)
      { lat: 43.252, lng: -126.453 }, // c (straight fallback b→c)
    ]);
  });

  it('produces no path for a day with fewer than two plottable stops', () => {
    const single = group('2026-06-04', [p('only', 0, 1, 2)]);
    expect(buildDayPaths([single], [], 'walk')).toEqual([]);
  });

  it('skips stops without coordinates (cannot plot them)', () => {
    const g2 = group('2026-06-04', [
      { ...p('a', 0, 35.0, 139.0) },
      { ...p('b', 1, 0, 0), lat: null as unknown as number, lng: null as unknown as number },
      { ...p('c', 2, 35.1, 139.1) },
    ]);
    // Only a and c are plottable; the path is the straight a→c fallback.
    const paths = buildDayPaths([g2], [], 'walk');
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
    const paths = buildDayPaths([g], legs, 'walk');
    // No matching leg → straight fallback.
    expect(paths[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
  });

  it('uses the correct mode-specific polyline when the same pair is cached in two modes', () => {
    // P1 is the walk polyline (a→b walk encodes two points ending at 40.7,-120.95)
    // P2 is a drive polyline (a→b drive encodes three points including 43.252,-126.453)
    const P1 = '_p~iF~ps|U_ulLnnqC';           // walk: 38.5,-120.2 → 40.7,-120.95
    const P2 = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'; // drive: 38.5,-120.2 → 40.7,-120.95 → 43.252,-126.453
    const legsMultiMode: LegDTO[] = [
      { fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk',
        durationSeconds: 0, distanceMeters: 0, polyline: P1 },
      { fromPlaceId: 'a', toPlaceId: 'b', mode: 'drive',
        durationSeconds: 0, distanceMeters: 0, polyline: P2 },
    ];
    const pathsWalk = buildDayPaths([g], legsMultiMode, 'walk');
    const pathsDrive = buildDayPaths([g], legsMultiMode, 'drive');

    // walk → uses P1: straight two-point path
    expect(pathsWalk[0]!.path).toEqual([
      { lat: 38.5,  lng: -120.2  },
      { lat: 40.7,  lng: -120.95 },
    ]);
    // drive → uses P2: three-point path
    expect(pathsDrive[0]!.path).toEqual([
      { lat: 38.5,   lng: -120.2   },
      { lat: 40.7,   lng: -120.95  },
      { lat: 43.252, lng: -126.453 },
    ]);
  });
});
