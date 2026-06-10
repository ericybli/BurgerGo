/** Pure eats helpers, ported from the web `src/lib/eatsView.ts`. */
import type { Restaurant, RestaurantStatus } from './api';

export type EatsFilter = 'all' | RestaurantStatus;

export function filterByStatus(restaurants: Restaurant[], filter: EatsFilter): Restaurant[] {
  if (filter === 'all') return restaurants;
  return restaurants.filter((r) => r.status === filter);
}

/** Returns null if unrated; else the filled/empty star split. */
export function ratingStars(rating: number | null): { filled: number; empty: number } | null {
  if (rating === null || rating < 1 || rating > 5) return null;
  return { filled: rating, empty: 5 - rating };
}

export function priceLevelLabel(level: number | null): string {
  if (level === null || level < 1 || level > 4) return '';
  return '$'.repeat(level);
}

export function nextStatus(status: RestaurantStatus): RestaurantStatus {
  return status === 'been' ? 'want-to-try' : 'been';
}
