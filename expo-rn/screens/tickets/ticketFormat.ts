const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat, Jun 6 · 6:30 PM" from stored YYYY-MM-DD / HH:MM (either may be null). Raw string passthrough if malformed. */
export function formatTicketWhen(date: string | null, time: string | null): string {
  const parts: string[] = [];
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const d = new Date(`${date}T00:00:00Z`);
    parts.push(`${WD[d.getUTCDay()]}, ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`);
  } else if (date) parts.push(date);
  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [h, m] = time.split(':').map(Number);
    const ap = h! < 12 ? 'AM' : 'PM';
    const h12 = h! % 12 === 0 ? 12 : h! % 12;
    parts.push(`${h12}:${String(m).padStart(2, '0')} ${ap}`);
  } else if (time) parts.push(time);
  return parts.join(' · ');
}

/** Group key for the day header: the date (YYYY-MM-DD) or 'anytime'. */
export const ticketDayKey = (date: string | null): string => date ?? 'anytime';

/** "SAT · JUN 6" header label; 'Anytime' for undated. */
export function ticketDayLabel(key: string): string {
  if (key === 'anytime') return 'Anytime';
  const d = new Date(`${key}T00:00:00Z`);
  return `${WD[d.getUTCDay()]!.toUpperCase()} · ${MO[d.getUTCMonth()]!.toUpperCase()} ${d.getUTCDate()}`;
}
