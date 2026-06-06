/**
 * Current time as a Unix epoch in **milliseconds**.
 * Single source of "now" so tests can mock the clock in one place.
 */
export function now(): number {
  return Date.now();
}
