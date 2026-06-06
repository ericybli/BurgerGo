/**
 * Pure helpers for the Plan tab URL contract (spec §2.2/§3.3:
 * `?view=list|map&bucket=days|saved&date=YYYY-MM-DD`), the canonical Place-card
 * thumbnail precedence (spec §5.8), and the `dayGroups` transform PlanClient
 * feeds to PlanMap (the locked B3 seam). No React, no Next router — the Plan UI
 * parses `useSearchParams()` through `parsePlanParams` and feeds `buildPlanQuery`
 * to `router.replace`. Personal photo uploads are Plan 2, so thumbnail
 * precedence is cached-Google-photo → category glyph.
 */
import type { DerivedDay } from '@/src/lib/days';
import { colorIndexForDay, placesForDay, savedPlaces, type PlaceDTO } from '@/src/lib/planView';
import { withBase } from '@/src/lib/basePath';

export type PlanView = 'list' | 'map';
export type PlanBucket = 'days' | 'saved';

export interface PlanParams {
  view: PlanView;
  bucket: PlanBucket;
  date: string; // YYYY-MM-DD, always within [startDate, endDate]
}

type Category = PlaceDTO['category'];

const CATEGORY_GLYPH: Record<Category, string> = {
  sightseeing: '🏛️',
  lodging: '🛏️',
  transport: '🚆',
  activity: '🎟️',
  other: '📍',
};

/** Category glyph for a place (placeholder thumbnail + meta-row icon). */
export function categoryGlyph(category: Category): string {
  return CATEGORY_GLYPH[category];
}

/**
 * Parse the Plan search params: defaults (list/days), clamp `date` into the trip
 * range, falling back to `landingDate` when missing/out-of-range. Unknown enum
 * values fall back to their defaults so a hand-edited URL never breaks the view.
 */
export function parsePlanParams(
  params: URLSearchParams,
  range: { startDate: string; endDate: string },
  landingDate: string,
): PlanParams {
  const view: PlanView = params.get('view') === 'map' ? 'map' : 'list';
  const bucket: PlanBucket = params.get('bucket') === 'saved' ? 'saved' : 'days';
  const raw = params.get('date');
  const date = raw && raw >= range.startDate && raw <= range.endDate ? raw : landingDate;
  return { view, bucket, date };
}

/** Serialize Plan params to a query string for `router.replace`. */
export function buildPlanQuery(p: PlanParams): string {
  return new URLSearchParams({ view: p.view, bucket: p.bucket, date: p.date }).toString();
}

/** URL for a place's cached Google card photo (B1 photos handler). */
export function cardPhotoUrl(placeId: string): string {
  return withBase(`/api/photos/${placeId}/card`);
}

/** URL for a personal photo derivative (Plan-2 serving handler). */
export function personalPhotoUrl(photoId: string, size: 'thumb' | 'card' | 'full'): string {
  return withBase(`/api/photos/p/${photoId}/${size}`);
}

export type Thumb = { kind: 'photo'; src: string } | { kind: 'glyph'; glyph: string };

/**
 * Canonical Place-card thumbnail (spec §5.6/§5.8). Precedence: first personal
 * photo → cached Google photo → category glyph.
 */
export function thumbForPlace(
  place: Pick<PlaceDTO, 'id' | 'category' | 'photoPath' | 'photos'>,
): Thumb {
  const first = place.photos[0];
  if (first) return { kind: 'photo', src: personalPhotoUrl(first.id, 'card') };
  if (place.photoPath) return { kind: 'photo', src: cardPhotoUrl(place.id) };
  return { kind: 'glyph', glyph: categoryGlyph(place.category) };
}

/** One PlanMap day group (locked B3 seam shape). */
export interface DayGroup {
  date: string | null;
  dayNumber: number | null;
  colorIndex: number;
  places: PlaceDTO[];
}

/**
 * Build the `dayGroups` array PlanClient passes to PlanMap. `days` bucket → one
 * group per trip day (ordered places, palette colorIndex by day index). `saved`
 * bucket → a single group with null date/dayNumber and colorIndex 0.
 */
export function buildDayGroups(
  bucket: PlanBucket,
  days: DerivedDay[],
  places: PlaceDTO[],
): DayGroup[] {
  if (bucket === 'saved') {
    return [{ date: null, dayNumber: null, colorIndex: 0, places: savedPlaces(places) }];
  }
  return days.map((d, i) => ({
    date: d.date,
    dayNumber: d.dayNumber,
    colorIndex: colorIndexForDay(i),
    places: placesForDay(places, d.date),
  }));
}
