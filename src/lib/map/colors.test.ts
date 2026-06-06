import { describe, it, expect } from 'vitest';
import { DAY_COLORS, colorForIndex, colorForGroup } from '@/src/lib/map/colors';

describe('DAY_COLORS', () => {
  it('is a non-empty palette of #RRGGBB hex strings', () => {
    expect(DAY_COLORS.length).toBeGreaterThan(0);
    for (const c of DAY_COLORS) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('leads with the spec route Coral (#EE5B3C) and includes Teal (#4F8A86)', () => {
    expect(DAY_COLORS[0]).toBe('#EE5B3C');
    expect(DAY_COLORS).toContain('#4F8A86');
  });
});

describe('colorForIndex', () => {
  it('returns the palette color for a given colorIndex', () => {
    expect(colorForIndex(0)).toBe(DAY_COLORS[0]);
    expect(colorForIndex(1)).toBe(DAY_COLORS[1]);
  });

  it('wraps around when colorIndex exceeds palette length', () => {
    expect(colorForIndex(DAY_COLORS.length)).toBe(DAY_COLORS[0]);
    expect(colorForIndex(DAY_COLORS.length + 1)).toBe(DAY_COLORS[1]);
  });

  it('falls back to the first color for negative or NaN indices', () => {
    expect(colorForIndex(-1)).toBe(DAY_COLORS[0]);
    expect(colorForIndex(NaN)).toBe(DAY_COLORS[0]);
  });
});

describe('colorForGroup', () => {
  it('resolves a DayGroup colorIndex to the palette color', () => {
    expect(colorForGroup({ colorIndex: 0 })).toBe(DAY_COLORS[0]);
    expect(colorForGroup({ colorIndex: 2 })).toBe(DAY_COLORS[2]);
  });

  it('wraps on overflow just like colorForIndex', () => {
    expect(colorForGroup({ colorIndex: DAY_COLORS.length })).toBe(DAY_COLORS[0]);
  });
});
