import { describe, it, expect, afterEach, vi } from 'vitest';
import type { DerivedDay } from '@/src/lib/days';
import type { PlaceDTO } from '@/src/lib/planView';
import {
  parsePlanParams,
  buildPlanQuery,
  categoryGlyph,
  thumbForPlace,
  thumbForRestaurant,
  cardPhotoUrl,
  restaurantCardPhotoUrl,
  personalPhotoUrl,
  buildDayGroups,
  type PlanParams,
} from '@/src/lib/planUrl';

const range = { startDate: '2026-05-03', endDate: '2026-05-05' };

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BASE_PATH;
  vi.resetModules();
});

function place(over: Partial<PlaceDTO> = {}): PlaceDTO {
  return {
    id: 'p1', tripId: 't1', dayDate: '2026-05-03', googlePlaceId: null,
    name: 'A', address: null, lat: 0, lng: 0, category: 'sightseeing',
    scheduledTime: null, durationMin: null, cost: null, notes: null,
    orderIndex: 0, photoPath: null, photos: [], aiSummary: null, links: [], legMode: null, ...over,
  };
}

describe('planUrl URL state', () => {
  it('applies defaults when params are missing', () => {
    const p = parsePlanParams(new URLSearchParams(''), range, '2026-05-03');
    expect(p).toEqual<PlanParams>({ view: 'list', bucket: 'days', date: '2026-05-03' });
  });

  it('falls back the date to the landing date when out of range', () => {
    const p = parsePlanParams(
      new URLSearchParams('view=map&bucket=saved&date=2026-12-31'),
      range,
      '2026-05-04',
    );
    expect(p).toEqual<PlanParams>({ view: 'map', bucket: 'saved', date: '2026-05-04' });
  });

  it('keeps an in-range date and clamps unknown enum values to defaults', () => {
    const p = parsePlanParams(
      new URLSearchParams('view=grid&bucket=other&date=2026-05-04'),
      range,
      '2026-05-03',
    );
    expect(p).toEqual<PlanParams>({ view: 'list', bucket: 'days', date: '2026-05-04' });
  });

  it('serializes a full param set deterministically', () => {
    expect(buildPlanQuery({ view: 'map', bucket: 'days', date: '2026-05-04' })).toBe(
      'view=map&bucket=days&date=2026-05-04',
    );
  });
});

describe('planUrl thumbnails', () => {
  it('categoryGlyph maps each enum to a glyph', () => {
    expect(categoryGlyph('sightseeing')).toBe('🏞️');
    expect(categoryGlyph('lodging')).toBe('🛏️');
    expect(categoryGlyph('hotel')).toBe('🏨');
    expect(categoryGlyph('airbnb')).toBe('🏠');
    expect(categoryGlyph('airport')).toBe('✈️');
    expect(categoryGlyph('transport')).toBe('🚆');
    expect(categoryGlyph('activity')).toBe('🎟️');
    expect(categoryGlyph('shopping')).toBe('🛍️');
    expect(categoryGlyph('parking')).toBe('🅿️');
    expect(categoryGlyph('entrance')).toBe('🚪');
    expect(categoryGlyph('museum')).toBe('🏛️');
    expect(categoryGlyph('event')).toBe('🎉');
    expect(categoryGlyph('other')).toBe('📍');
  });

  it('cardPhotoUrl points at the B1 photos handler card variant', () => {
    expect(cardPhotoUrl('p9')).toBe('/api/photos/p9/card');
  });

  it('cardPhotoUrl is prefixed with the base path when NEXT_PUBLIC_BASE_PATH is set', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_BASE_PATH = '/burgergo';
    const { cardPhotoUrl: prefixed } = await import('@/src/lib/planUrl');
    expect(prefixed('p9')).toBe('/burgergo/api/photos/p9/card');
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    vi.resetModules();
  });

  it('thumbForPlace prefers the cached photo (served via the photos handler), else the glyph', () => {
    expect(thumbForPlace(place({ id: 'p9', category: 'sightseeing', photoPath: '/x/y.webp' }))).toEqual({
      kind: 'photo',
      src: '/api/photos/p9/card',
    });
    expect(thumbForPlace(place({ category: 'lodging', photoPath: null }))).toEqual({
      kind: 'glyph',
      glyph: '🛏️',
    });
  });
});

describe('personalPhotoUrl', () => {
  it('builds the base-prefixed personal-photo serving URL for a size', () => {
    expect(personalPhotoUrl('photo-1', 'card')).toBe('/api/photos/p/photo-1/card');
    expect(personalPhotoUrl('photo-1', 'full')).toBe('/api/photos/p/photo-1/full');
  });
});

describe('thumbForRestaurant', () => {
  it('restaurantCardPhotoUrl points at the restaurant photo handler card variant', () => {
    expect(restaurantCardPhotoUrl('r9')).toBe('/api/photos/r/r9/card');
  });

  it('prefers the first personal photo, then the cached Google photo, then the dining glyph', () => {
    // personal wins
    expect(
      thumbForRestaurant({ id: 'r1', photoPath: 'gphotos/g1.webp', photos: [{ id: 'ph1' }] }),
    ).toEqual({ kind: 'photo', src: '/api/photos/p/ph1/card' });
    // else the cached Google photo (served via the restaurant handler)
    expect(
      thumbForRestaurant({ id: 'r1', photoPath: 'gphotos/g1.webp', photos: [] }),
    ).toEqual({ kind: 'photo', src: '/api/photos/r/r1/card' });
    // else the dining glyph
    expect(
      thumbForRestaurant({ id: 'r1', photoPath: null, photos: [] }),
    ).toEqual({ kind: 'glyph', glyph: '🍽️' });
  });
});

describe('thumbForPlace precedence (Plan 2)', () => {
  const base = { id: 'p1', category: 'other' as const, photoPath: null, photos: [] as { id: string; width: number | null; height: number | null }[] };

  it('prefers the first personal photo over a cached Google photo', () => {
    const t = thumbForPlace({ ...base, photoPath: 'gpid/card.webp', photos: [{ id: 'ph1', width: null, height: null }] });
    expect(t).toEqual({ kind: 'photo', src: '/api/photos/p/ph1/card' });
  });

  it('falls back to the cached Google photo when there are no personal photos', () => {
    const t = thumbForPlace({ ...base, photoPath: 'gpid/card.webp', photos: [] });
    expect(t).toEqual({ kind: 'photo', src: '/api/photos/p1/card' });
  });

  it('falls back to the category glyph when neither exists', () => {
    const t = thumbForPlace({ ...base });
    expect(t).toEqual({ kind: 'glyph', glyph: '📍' });
  });
});

describe('buildDayGroups (PlanMap seam)', () => {
  const days: DerivedDay[] = [
    { date: '2026-05-03', dayNumber: 1, weekday: 'Sunday', isToday: false },
    { date: '2026-05-04', dayNumber: 2, weekday: 'Monday', isToday: false },
  ];
  const places = [
    place({ id: 'a', dayDate: '2026-05-03', orderIndex: 0 }),
    place({ id: 'b', dayDate: '2026-05-03', orderIndex: 1 }),
    place({ id: 'c', dayDate: '2026-05-04', orderIndex: 0 }),
    place({ id: 's', dayDate: null, orderIndex: 0 }),
  ];

  it('days bucket → one group per trip day, ordered, with colorIndex + dayNumber', () => {
    const groups = buildDayGroups('days', days, places);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ date: '2026-05-03', dayNumber: 1, colorIndex: 0 });
    expect(groups[0]!.places.map((p) => p.id)).toEqual(['a', 'b']);
    expect(groups[1]).toMatchObject({ date: '2026-05-04', dayNumber: 2, colorIndex: 1 });
    expect(groups[1]!.places.map((p) => p.id)).toEqual(['c']);
  });

  it('saved bucket → a single group with null date/dayNumber and colorIndex 0', () => {
    const groups = buildDayGroups('saved', days, places);
    expect(groups).toEqual([
      { date: null, dayNumber: null, colorIndex: 0, places: [places[3]] },
    ]);
  });
});
