/**
 * Per-day color palette for the Plan▸Map view (spec §3.4 / §9.1).
 * Each day group in the active bucket receives a stable color driven by its
 * `colorIndex` (assigned by B2's PlanClient) used for pins, polylines, and
 * legend chips. The palette wraps modulo its length for long trips.
 *
 * Day 1 leads with the route Coral (#EE5B3C, spec §9.1); remaining entries
 * are visually distinct hues from the "Sunset Wanderer" family + Teal.
 */
export const DAY_COLORS: readonly string[] = [
  '#EE5B3C', // coral  — day 1 route color (spec §9.1)
  '#4F8A86', // teal
  '#E0992F', // amber
  '#7E6BBF', // violet
  '#3E8E6E', // green  (= Tailwind `success`)
  '#C2452E', // brick  (= Tailwind `danger`)
  '#2F6F8F', // ocean
  '#B5642A', // clay
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
