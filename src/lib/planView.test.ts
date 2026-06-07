import { describe, it, expect } from 'vitest';
import {
  bucketByDay,
  savedPlaces,
  placesForDay,
  dayColor,
  colorIndexForDay,
  pinLabel,
  DAY_COLORS,
  type PlaceDTO,
} from '@/src/lib/planView';

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1',
    tripId: 't1',
    dayDate: '2026-05-03',
    googlePlaceId: null,
    name: 'Senso-ji',
    address: 'Asakusa',
    lat: 35.71,
    lng: 139.79,
    category: 'sightseeing',
    scheduledTime: null,
    durationMin: null,
    cost: null,
    notes: null,
    orderIndex: 0,
    photoPath: null,
    photos: [],
    aiSummary: null,
    legMode: null,
    links: [],
    ...over,
  };
}

describe('planView helpers', () => {
  it('placesForDay returns only that day, sorted by orderIndex', () => {
    const places = [
      place({ id: 'b', dayDate: '2026-05-03', orderIndex: 1 }),
      place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
      place({ id: 'c', dayDate: '2026-05-04', orderIndex: 0 }),
      place({ id: 's', dayDate: null, orderIndex: 0 }),
    ];
    expect(placesForDay(places, '2026-05-03').map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('savedPlaces returns only dayDate=null rows, sorted by orderIndex', () => {
    const places = [
      place({ id: 's2', dayDate: null, orderIndex: 1 }),
      place({ id: 's1', dayDate: null, orderIndex: 0 }),
      place({ id: 'd', dayDate: '2026-05-03', orderIndex: 0 }),
    ];
    expect(savedPlaces(places).map((p) => p.id)).toEqual(['s1', 's2']);
  });

  it('bucketByDay groups by dayDate and excludes saved', () => {
    const places = [
      place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
      place({ id: 'b', dayDate: '2026-05-04', orderIndex: 0 }),
      place({ id: 's', dayDate: null, orderIndex: 0 }),
    ];
    const buckets = bucketByDay(places);
    expect(Object.keys(buckets).sort()).toEqual(['2026-05-03', '2026-05-04']);
    expect(buckets['2026-05-03']!.map((p) => p.id)).toEqual(['a']);
  });

  it('pinLabel is orderIndex + 1', () => {
    expect(pinLabel(place({ orderIndex: 0 }))).toBe(1);
    expect(pinLabel(place({ orderIndex: 4 }))).toBe(5);
  });

  it('colorIndexForDay clamps/cycles, never out of range', () => {
    expect(colorIndexForDay(0)).toBe(0);
    expect(colorIndexForDay(1)).toBe(1);
    expect(colorIndexForDay(DAY_COLORS.length)).toBe(0); // wraps
    expect(colorIndexForDay(-3)).toBe(0); // clamps
  });

  it('dayColor is stable per day index and cycles through the palette', () => {
    expect(dayColor(0)).toBe(DAY_COLORS[0]);
    expect(dayColor(1)).toBe(DAY_COLORS[1]);
    expect(dayColor(DAY_COLORS.length)).toBe(DAY_COLORS[0]);
    expect(dayColor(-3)).toBe(DAY_COLORS[0]);
  });
});
