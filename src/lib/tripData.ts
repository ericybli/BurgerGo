import { withBase } from '@/src/lib/basePath';
import type { Trip } from '@/src/db/schema';

/** Shape returned by `GET /api/trips/:id` (only the fields callers consume). */
export type TripFetchResult = { trip: Trip };

/**
 * In-flight requests keyed by tripId. We cache only the pending promise and
 * clear it on settle — so concurrent callers share one request, but there is no
 * stale data across navigations (the next call after settle re-fetches fresh).
 */
const inFlight = new Map<string, Promise<TripFetchResult>>();

/**
 * Fetch a trip's header data, coalescing concurrent callers.
 *
 * The trip shell (`TripShellClient`) and the active tab client (`PlanClient` /
 * `EatsClient`) both need `/api/trips/:id` on mount. Without coalescing each
 * fires its own request — two identical origin round-trips per page load. This
 * helper hands both callers the same in-flight promise so only one request is
 * made. Throws on a non-ok response (callers map that to not-found / error).
 */
export function fetchTripData(tripId: string): Promise<TripFetchResult> {
  const existing = inFlight.get(tripId);
  if (existing) return existing;

  const request = fetch(withBase(`/api/trips/${tripId}`), { credentials: 'same-origin' })
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<TripFetchResult>;
    })
    .finally(() => {
      inFlight.delete(tripId);
    });

  inFlight.set(tripId, request);
  return request;
}

/**
 * Test-only: clear the in-flight map so module-level state can't leak between
 * tests (e.g. a test that stubs a never-resolving `fetch` would otherwise leave
 * a stuck entry that poisons later callers of the same tripId).
 */
export function __resetTripDataForTests(): void {
  inFlight.clear();
}
