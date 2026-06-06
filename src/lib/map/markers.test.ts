import { describe, it, expect } from 'vitest';
import { buildMarkers, buildSavedMarkers } from '@/src/lib/map/markers';
import { DAY_COLORS } from '@/src/lib/map/colors';
import type { DayGroup, PlaceDTO } from '@/src/lib/map/types';

function p(id: string, orderIndex: number, lat: number | null, lng: number | null,
           extra: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id, orderIndex, lat, lng,
    name: id, category: 'other', tripId: 't', dayDate: '2026-06-04',
    googlePlaceId: null, address: null, scheduledTime: null, durationMin: null,
    cost: null, notes: null, photoPath: null, ...extra,
  };
}

function group(colorIndex: number, places: PlaceDTO[]): DayGroup {
  return { date: '2026-06-04', dayNumber: 1, colorIndex, places };
}

describe('buildMarkers', () => {
  it('returns one marker per plottable place, sorted by orderIndex, labeled orderIndex+1', () => {
    const g = group(0, [
      p('b', 1, 35.1, 139.1),
      p('a', 0, 35.0, 139.0),
    ]);
    const markers = buildMarkers(g);
    expect(markers.map((m) => m.id)).toEqual(['a', 'b']);
    expect(markers.map((m) => m.label)).toEqual(['1', '2']);
  });

  it('assigns the palette color matching colorIndex', () => {
    const markers = buildMarkers(group(1, [p('a', 0, 35.0, 139.0)]));
    expect(markers[0]!.color).toBe(DAY_COLORS[1]);
  });

  it('wraps the color when colorIndex exceeds the palette', () => {
    const markers = buildMarkers(group(DAY_COLORS.length, [p('a', 0, 35.0, 139.0)]));
    expect(markers[0]!.color).toBe(DAY_COLORS[0]);
  });

  it('drops places without coordinates', () => {
    const g = group(0, [
      p('has', 0, 35.0, 139.0),
      p('no-lat', 1, null, 139.0),
      p('no-lng', 2, 35.0, null),
    ]);
    const markers = buildMarkers(g);
    expect(markers.map((m) => m.id)).toEqual(['has']);
  });

  it('uses orderIndex+1 labels so a coord-less stop mid-day keeps list/map numbering consistent', () => {
    // orderIndex 0 = has coords → label "1"
    // orderIndex 1 = no coords → dropped from markers
    // orderIndex 2 = has coords → label "3" (not "2"), matching list PlaceCard
    const g = group(0, [
      p('first',  0, 35.0, 139.0),
      p('skip',   1, null, null),
      p('third',  2, 35.1, 139.1),
    ]);
    const markers = buildMarkers(g);
    expect(markers.map((m) => m.id)).toEqual(['first', 'third']);
    expect(markers.map((m) => m.label)).toEqual(['1', '3']);
  });

  it('carries name, category, googlePlaceId, photoPath for the info card', () => {
    const g = group(0, [
      p('p', 0, 35.0, 139.0, { name: 'Tower', category: 'activity',
                                googlePlaceId: 'gx',
                                photoPath: '/api/photos/gx/card' }),
    ]);
    const m = buildMarkers(g)[0]!;
    expect(m.name).toBe('Tower');
    expect(m.category).toBe('activity');
    expect(m.googlePlaceId).toBe('gx');
    expect(m.photoPath).toBe('/api/photos/gx/card');
  });

  it('returns an empty array for a group with no plottable places', () => {
    expect(buildMarkers(group(0, [p('z', 0, null, null)]))).toEqual([]);
  });
});

describe('buildSavedMarkers', () => {
  it('returns only plottable Saved places, un-numbered, no color', () => {
    const places: PlaceDTO[] = [
      p('s1', 0, 35.0, 139.0),
      p('s2', 1, 35.1, 139.1),
      p('no', 2, null, null),
    ];
    const markers = buildSavedMarkers(places);
    expect(markers.map((m) => m.id)).toEqual(['s1', 's2']);
    expect(markers.every((m) => m.label === null)).toBe(true);
    expect(markers.every((m) => m.color === null)).toBe(true);
  });
});
