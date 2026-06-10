/**
 * Day derivation, ported minimal from the web app. Days are computed from the
 * trip's start/end dates (never stored). Pure UTC string math + local "today" so
 * it doesn't depend on Intl timezone support (limited under Hermes).
 */
export type Day = {
  date: string; // YYYY-MM-DD
  dayNumber: number; // 1-based
  weekday: string; // "Mon"
  isToday: boolean;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(dateStr: string): string {
  return WEEKDAYS[new Date(`${dateStr}T00:00:00Z`).getUTCDay()]!;
}

/** Today's calendar date (YYYY-MM-DD) in the device's local timezone. */
export function todayLocal(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function deriveDays(startDate: string, endDate: string): Day[] {
  const today = todayLocal();
  const days: Day[] = [];
  let cursor = startDate;
  let n = 1;
  while (cursor <= endDate) {
    days.push({ date: cursor, dayNumber: n, weekday: weekdayOf(cursor), isToday: cursor === today });
    cursor = addDays(cursor, 1);
    n += 1;
  }
  return days;
}
