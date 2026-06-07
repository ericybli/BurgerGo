/**
 * Cross-component refresh signal. The AI-import sheet lives in the trip shell
 * (a sibling of the tab clients), so it can't call their `load()` directly.
 * After it creates places/restaurants it dispatches this window event; the Plan
 * and Eats clients listen for it and re-fetch, so imports show up immediately.
 */
export const TRIP_DATA_CHANGED = 'burgergo:trip-data-changed';

/** Dispatch the refresh signal (no-op outside the browser). */
export function emitTripDataChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(TRIP_DATA_CHANGED));
  }
}
