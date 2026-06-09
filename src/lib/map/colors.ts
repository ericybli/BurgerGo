/**
 * Per-day color palette for the Plan▸Map view (spec §3.4 / §9.1).
 * Each day group in the active bucket receives a stable color driven by its
 * `colorIndex` (assigned by B2's PlanClient) used for pins, polylines, and
 * legend chips. The palette wraps modulo its length for long trips.
 *
 * Atlas Light day cycle (design handoff `design_handoff_atlas_light`):
 * teal → amber → violet → red, matching the `day-1..day-4` Tailwind tokens.
 */
export const DAY_COLORS: readonly string[] = [
  '#33677A', // teal   — day 1 (Atlas accent)
  '#C99231', // amber  — day 2
  '#7A5FA0', // violet — day 3
  '#B3402C', // red    — day 4
];

/**
 * Return the palette color for a numeric `colorIndex`.
 * Wraps modulo the palette length; any invalid value (negative, NaN) falls
 * back to the first color.
 */
export function colorForIndex(colorIndex: number): string {
  if (!Number.isFinite(colorIndex) || colorIndex < 0) return DAY_COLORS[0]!;
  return DAY_COLORS[colorIndex % DAY_COLORS.length]!;
}

/**
 * Convenience overload that accepts any object with a `colorIndex` field —
 * matches the B2 `DayGroup` prop shape directly.
 */
export function colorForGroup(group: { colorIndex: number }): string {
  return colorForIndex(group.colorIndex);
}
