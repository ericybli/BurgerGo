import type { RestaurantDTO } from '@/app/api/trips/[tripId]/restaurants/route';

export type EatsStatusFilter = 'all' | 'want-to-try' | 'been';

/** `$`…`$$$$` for a 1–4 price level; '' for null / out-of-range. */
export function priceLevelLabel(level: number | null): string {
  if (level == null || level < 1 || level > 4) return '';
  return '$'.repeat(level);
}

/** Filled/empty star counts for a 1–5 rating; null for null / out-of-range. */
export function ratingStars(rating: number | null): { filled: number; empty: number } | null {
  if (rating == null || rating < 1 || rating > 5) return null;
  return { filled: rating, empty: 5 - rating };
}

/** Filter a restaurant list by status; 'all' passes everything through. */
export function filterByStatus(list: RestaurantDTO[], filter: EatsStatusFilter): RestaurantDTO[] {
  if (filter === 'all') return list;
  return list.filter((r) => r.status === filter);
}
