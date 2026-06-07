/**
 * Day derivation + trip status (spec §5.4, §3.8). Days are computed from
 * `start_date`/`end_date` rather than stored. "Today" is read from the
 * system clock and resolved in the container timezone via `Intl` so the
 * server redirect and the client day strip never disagree on the active day.
 * Both helpers take exactly (trip, tz) — no injected `now` — so tests freeze
 * time with `vi.useFakeTimers()` + `vi.setSystemTime(...)`.
 */

/** Minimal trip shape needed for day math (calendar-date strings). */
export interface TripDates {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface DerivedDay {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1-based: Day 1 = startDate
  weekday: string; // e.g. "Sunday" (locale-independent English long name)
  isToday: boolean;
}

export type TripStatus = 'upcoming' | 'active' | 'past';

/** Today's calendar date (YYYY-MM-DD) in the given IANA timezone. */
function todayInTz(tz: string): string {
  // 'en-CA' yields ISO YYYY-MM-DD; timeZone shifts the wall date into `tz`.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** English long weekday for a calendar date string (timezone-stable via UTC). */
function weekdayOf(dateStr: string): string {
  // Parse as a UTC midnight so the weekday never shifts with the host TZ.
  const d = new Date(`${dateStr}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
  }).format(d);
}

/** Add `n` calendar days to a YYYY-MM-DD string (UTC arithmetic; n may be negative). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from `a` to `b` (b − a); negative when b precedes a. */
export function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** Advance a YYYY-MM-DD string by one calendar day (UTC arithmetic). */
function nextDate(dateStr: string): string {
  return addDays(dateStr, 1);
}

/**
 * Expand `[startDate, endDate]` (inclusive) into an ordered day list with
 * 1-based numbers, English weekday names, and a TZ-aware `isToday` flag.
 */
export function deriveDays(trip: TripDates, tz: string): DerivedDay[] {
  const today = todayInTz(tz);
  const days: DerivedDay[] = [];
  let cursor = trip.startDate;
  let n = 1;
  // Lexicographic comparison is valid for zero-padded YYYY-MM-DD strings.
  while (cursor <= trip.endDate) {
    days.push({
      date: cursor,
      dayNumber: n,
      weekday: weekdayOf(cursor),
      isToday: cursor === today,
    });
    cursor = nextDate(cursor);
    n += 1;
  }
  return days;
}

/**
 * 'upcoming' if today < startDate, 'past' if today > endDate, else 'active'
 * (boundaries inclusive). Today is resolved in the container `tz`.
 */
export function tripStatus(trip: TripDates, tz: string): TripStatus {
  const today = todayInTz(tz);
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'active';
}
