/**
 * Pure text export of a day's itinerary (name, category, time, address only —
 * no notes / AI summary / journal). Used by the Plan tab's "copy day as text"
 * action so a plain-text plan can be pasted anywhere. No React, no i18n: the
 * caller passes already-resolved category labels.
 */
export interface DayItineraryItem {
  name: string;
  category: string; // display label, e.g. "Sightseeing"
  time: string | null; // HH:MM, or null
  address: string | null;
}

/**
 * Format `items` (in order) under `header`. Each stop is numbered:
 *   `1. Name (Category) · 09:00`
 *   `   123 Some St`            (indented; omitted when no address)
 * Time is omitted when unset. Returns just the header when there are no items.
 */
export function formatDayItinerary(header: string, items: DayItineraryItem[]): string {
  if (items.length === 0) return header;
  const lines = items.map((it, i) => {
    const head = `${i + 1}. ${it.name} (${it.category})${it.time ? ` · ${it.time}` : ''}`;
    return it.address ? `${head}\n   ${it.address}` : head;
  });
  return `${header}\n\n${lines.join('\n')}`;
}
