/**
 * The single Plan/Days landing date (spec §2 / §3.8). Active trip → today
 * (container TZ); upcoming/past → the start date (explicit Day 1 keeps the
 * cached URL stable; never a bare /plan). Reuses `tripStatus` from days.ts so
 * status logic lives in one place; `todayInTz` mirrors days.ts's exact Intl call
 * so results never diverge. Pure: reads the system clock; tests freeze time.
 */
import { tripStatus, type TripDates } from '@/src/lib/days';

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function landingDate(trip: TripDates, tz: string): string {
  return tripStatus(trip, tz) === 'active' ? todayInTz(tz) : trip.startDate;
}
