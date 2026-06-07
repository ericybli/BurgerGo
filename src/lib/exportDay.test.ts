import { describe, it, expect } from 'vitest';
import { formatDayItinerary } from '@/src/lib/exportDay';

describe('formatDayItinerary', () => {
  it('numbers stops with category + time, indents the address, and omits absent fields', () => {
    const text = formatDayItinerary('Day 2 · 2026-06-07', [
      { name: 'Mauna Kea Visitor', category: 'Sightseeing', time: '09:00', address: '78-7138 Kaleiopapa St' },
      { name: 'Kona Airport', category: 'Transport', time: null, address: null },
    ]);
    expect(text).toBe(
      'Day 2 · 2026-06-07\n\n' +
        '1. Mauna Kea Visitor (Sightseeing) · 09:00\n' +
        '   78-7138 Kaleiopapa St\n' +
        '2. Kona Airport (Transport)',
    );
  });

  it('returns just the header when there are no stops', () => {
    expect(formatDayItinerary('Day 1 · 2026-06-07', [])).toBe('Day 1 · 2026-06-07');
  });
});
