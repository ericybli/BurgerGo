/**
 * Home-local date helpers, ported from the web app's `src/lib/days.ts` and
 * `components/TripCard.tsx`. Manual en-US "MMM d" formatting (UTC parts) so we
 * don't depend on Intl timezone support under Hermes. "Today" uses the device
 * timezone (web resolves it in the server `env.TZ` — accepted divergence).
 */
import { todayLocal } from '../../lib/days';

export type TripStatus = 'upcoming' | 'active' | 'past';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 4" for "2026-09-04" (en-US MMM d, UTC-parsed). */
export function formatMonthDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** Whole calendar days from `a` to `b` (b − a); negative when b precedes a. */
export function diffDays(a: string, b: string): number {
  const ms = new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** ICU-equivalent plural: "1 day" / "9 days". */
export function formatDayCount(days: number): string {
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

/** "Sep 4 – Sep 12 · 9 days" (en dash, middot, inclusive day count). */
export function formatRange(startDate: string, endDate: string): {
  start: string;
  end: string;
  days: number;
  label: string;
} {
  const start = formatMonthDay(startDate);
  const end = formatMonthDay(endDate);
  const days = diffDays(startDate, endDate) + 1;
  return { start, end, days, label: `${start} – ${end} · ${formatDayCount(days)}` };
}

/**
 * 'upcoming' if today < startDate, 'past' if today > endDate, else 'active'
 * (boundaries inclusive; lexicographic compare is valid for YYYY-MM-DD).
 */
export function tripStatus(trip: { startDate: string; endDate: string }): TripStatus {
  const today = todayLocal();
  if (today < trip.startDate) return 'upcoming';
  if (today > trip.endDate) return 'past';
  return 'active';
}

export { todayLocal };
