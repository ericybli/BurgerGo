import { describe, it, expect, vi, afterEach } from 'vitest';
import { deriveDays, tripStatus } from '@/src/lib/days';

/** Minimal trip shape consumed by the day helpers. */
const trip = (startDate: string, endDate: string) => ({ startDate, endDate });

/** Freeze wall-clock time to a fixed UTC instant for deterministic "today". */
function freezeUtc(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

afterEach(() => {
  vi.useRealTimers();
});

describe('deriveDays', () => {
  it('expands an inclusive date range into ordered days', () => {
    const days = deriveDays(trip('2026-05-03', '2026-05-05'), 'UTC');
    expect(days.map((d) => d.date)).toEqual(['2026-05-03', '2026-05-04', '2026-05-05']);
    expect(days.map((d) => d.dayNumber)).toEqual([1, 2, 3]);
  });

  it('returns a single day when start === end', () => {
    const days = deriveDays(trip('2026-06-05', '2026-06-05'), 'UTC');
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ date: '2026-06-05', dayNumber: 1 });
  });

  it('crosses month and year boundaries correctly', () => {
    const days = deriveDays(trip('2026-12-30', '2027-01-02'), 'UTC');
    expect(days.map((d) => d.date)).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ]);
    expect(days.at(-1)!.dayNumber).toBe(4);
  });

  it('labels weekday names', () => {
    // 2026-05-03 is a Sunday.
    const days = deriveDays(trip('2026-05-03', '2026-05-04'), 'UTC');
    expect(days[0]!.weekday).toBe('Sunday');
    expect(days[1]!.weekday).toBe('Monday');
  });

  it('flags isToday using the container timezone', () => {
    // 2026-06-05T20:00Z is 2026-06-06 in Asia/Tokyo (+09:00).
    freezeUtc('2026-06-05T20:00:00Z');
    const days = deriveDays(trip('2026-06-04', '2026-06-07'), 'Asia/Tokyo');
    const today = days.find((d) => d.isToday);
    expect(today?.date).toBe('2026-06-06');
    // Same instant in UTC is still June 5.
    const daysUtc = deriveDays(trip('2026-06-04', '2026-06-07'), 'UTC');
    expect(daysUtc.find((d) => d.isToday)?.date).toBe('2026-06-05');
  });

  it('marks no day as today when today is outside the range', () => {
    freezeUtc('2026-01-01T12:00:00Z');
    const days = deriveDays(trip('2026-06-04', '2026-06-07'), 'UTC');
    expect(days.some((d) => d.isToday)).toBe(false);
  });
});

describe('tripStatus', () => {
  it('is upcoming when today is before the start date', () => {
    freezeUtc('2026-06-01T12:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('upcoming');
  });

  it('is active when today is within the inclusive range', () => {
    freezeUtc('2026-06-05T12:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
  });

  it('is active on the boundary days (inclusive)', () => {
    freezeUtc('2026-06-04T12:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
    freezeUtc('2026-06-07T12:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('active');
  });

  it('is past when today is after the end date', () => {
    freezeUtc('2026-06-08T12:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('past');
  });

  it('respects the container timezone at the day boundary', () => {
    // 2026-06-03T23:00Z is 2026-06-04 in Asia/Tokyo → active on a trip starting 06-04.
    freezeUtc('2026-06-03T23:00:00Z');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'Asia/Tokyo')).toBe('active');
    expect(tripStatus(trip('2026-06-04', '2026-06-07'), 'UTC')).toBe('upcoming');
  });
});
