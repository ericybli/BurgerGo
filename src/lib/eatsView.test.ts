import { describe, it, expect } from 'vitest';
import {
  priceLevelLabel,
  ratingStars,
  filterByStatus,
  type EatsStatusFilter,
} from '@/src/lib/eatsView';
import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

function r(over: Partial<RestaurantDTO> = {}): RestaurantDTO {
  return {
    id: 'r1', tripId: 't1', name: 'A', cuisine: null, rating: null,
    status: 'want-to-try', priceLevel: null, notes: null, linkedPlaceId: null,
    createdAt: new Date(0), updatedAt: new Date(0), scheduledDayDate: null, ...over,
  };
}

describe('priceLevelLabel', () => {
  it('renders 1–4 as $ … $$$$', () => {
    expect(priceLevelLabel(1)).toBe('$');
    expect(priceLevelLabel(2)).toBe('$$');
    expect(priceLevelLabel(3)).toBe('$$$');
    expect(priceLevelLabel(4)).toBe('$$$$');
  });
  it('returns empty string for null / out-of-range', () => {
    expect(priceLevelLabel(null)).toBe('');
    expect(priceLevelLabel(0)).toBe('');
    expect(priceLevelLabel(5)).toBe('');
  });
});

describe('ratingStars', () => {
  it('returns filled/empty counts for a 1–5 rating', () => {
    expect(ratingStars(3)).toEqual({ filled: 3, empty: 2 });
    expect(ratingStars(5)).toEqual({ filled: 5, empty: 0 });
    expect(ratingStars(1)).toEqual({ filled: 1, empty: 4 });
  });
  it('returns null for null / out-of-range', () => {
    expect(ratingStars(null)).toBeNull();
    expect(ratingStars(0)).toBeNull();
    expect(ratingStars(6)).toBeNull();
  });
});

describe('filterByStatus', () => {
  const list = [r({ id: 'a', status: 'want-to-try' }), r({ id: 'b', status: 'been' })];
  it('all → unchanged', () => {
    expect(filterByStatus(list, 'all').map((x) => x.id)).toEqual(['a', 'b']);
  });
  it('want-to-try → only want-to-try', () => {
    expect(filterByStatus(list, 'want-to-try').map((x) => x.id)).toEqual(['a']);
  });
  it('been → only been', () => {
    expect(filterByStatus(list, 'been').map((x) => x.id)).toEqual(['b']);
  });
  it('is exhaustive over the filter union', () => {
    const all: EatsStatusFilter[] = ['all', 'want-to-try', 'been'];
    for (const f of all) expect(Array.isArray(filterByStatus(list, f))).toBe(true);
  });
});
