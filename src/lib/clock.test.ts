import { describe, it, expect } from 'vitest';
import { now } from '@/src/lib/clock';

describe('now', () => {
  it('returns the current epoch in milliseconds as an integer', () => {
    const before = Date.now();
    const t = now();
    const after = Date.now();
    expect(Number.isInteger(t)).toBe(true);
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });
});
