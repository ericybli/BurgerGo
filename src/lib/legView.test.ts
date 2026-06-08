import { describe, it, expect } from 'vitest';
import type { LegDTO, PlaceDTO } from '@/src/lib/planView';
import {
  indexLegs,
  legBetween,
  formatLeg,
  nextStopIndex,
  LEG_PLACEHOLDER,
  type LegLookup,
} from '@/src/lib/legView';

function leg(over: Partial<LegDTO> = {}): LegDTO {
  return {
    fromPlaceId: 'a',
    toPlaceId: 'b',
    mode: 'walk',
    durationSeconds: 720,
    distanceMeters: 900,
    polyline: null,
    ...over,
  };
}

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'a', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'Stop', address: null, lat: 0, lng: 0, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, listId: null, ...over,
  };
}

describe('legView helpers', () => {
  it('legBetween finds a cached leg by (from,to,mode) and misses otherwise', () => {
    const lookup: LegLookup = indexLegs([leg({ fromPlaceId: 'a', toPlaceId: 'b', mode: 'walk' })]);
    expect(legBetween(lookup, 'a', 'b', 'walk')?.durationSeconds).toBe(720);
    expect(legBetween(lookup, 'a', 'b', 'drive')).toBeUndefined();
    expect(legBetween(lookup, 'b', 'a', 'walk')).toBeUndefined();
  });

  it('formatLeg renders mode glyph + minutes + km', () => {
    expect(formatLeg(leg({ mode: 'walk', durationSeconds: 720, distanceMeters: 900 }))).toBe(
      '🚶 12 min · 0.9 km',
    );
    expect(formatLeg(leg({ mode: 'drive', durationSeconds: 305, distanceMeters: 4200 }))).toBe(
      '🚗 5 min · 4.2 km',
    );
    expect(formatLeg(leg({ mode: 'transit', durationSeconds: 60, distanceMeters: 150 }))).toBe(
      '🚆 1 min · 0.2 km',
    );
  });

  it('formatLeg clamps sub-minute durations to a 1 min floor', () => {
    expect(formatLeg(leg({ mode: 'walk', durationSeconds: 20, distanceMeters: 150 }))).toBe(
      '🚶 1 min · 0.2 km',
    );
  });

  it('formatLeg returns the canonical placeholder for an absent leg', () => {
    expect(formatLeg(undefined)).toBe(LEG_PLACEHOLDER);
    expect(LEG_PLACEHOLDER).toBe('—');
  });

  it('nextStopIndex picks the first strictly-future scheduled stop', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:00' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: '13:00' }),
      place({ id: 'c', orderIndex: 2, scheduledTime: '18:00' }),
    ];
    expect(nextStopIndex(stops, '11:30')).toBe(1);
  });

  it('nextStopIndex treats a stop scheduled exactly now as past', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:30' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: '11:00' }),
    ];
    expect(nextStopIndex(stops, '09:30')).toBe(1);
  });

  it('nextStopIndex falls back to stop 0 when no stop has a future time', () => {
    const stops = [
      place({ id: 'a', orderIndex: 0, scheduledTime: '09:00' }),
      place({ id: 'b', orderIndex: 1, scheduledTime: null }),
    ];
    expect(nextStopIndex(stops, '23:00')).toBe(0);
  });

  it('nextStopIndex defaults to stop 0 when no stop has a time', () => {
    const stops = [place({ id: 'a', orderIndex: 0 }), place({ id: 'b', orderIndex: 1 })];
    expect(nextStopIndex(stops, '10:00')).toBe(0);
  });

  it('nextStopIndex returns -1 for an empty day', () => {
    expect(nextStopIndex([], '10:00')).toBe(-1);
  });
});
