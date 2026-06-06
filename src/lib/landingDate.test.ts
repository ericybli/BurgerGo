import { describe, it, expect, vi, afterEach } from 'vitest';
import { landingDate } from '@/src/lib/landingDate';

function freezeUtc(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}
afterEach(() => vi.useRealTimers());

const trip = (startDate: string, endDate: string) => ({ startDate, endDate });

describe('landingDate', () => {
  it('returns today when the trip is active (today within range)', () => {
    freezeUtc('2026-06-05T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-05');
  });

  it('returns the start date for an upcoming trip', () => {
    freezeUtc('2026-06-01T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns the start date for a past trip (stable Day 1 URL)', () => {
    freezeUtc('2026-07-01T10:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns today on the inclusive start boundary', () => {
    freezeUtc('2026-06-03T00:00:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-03');
  });

  it('returns today on the inclusive end boundary', () => {
    freezeUtc('2026-06-08T23:59:00Z');
    expect(landingDate(trip('2026-06-03', '2026-06-08'), 'UTC')).toBe('2026-06-08');
  });
});
