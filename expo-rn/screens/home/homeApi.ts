/**
 * Home-local API extras: add/remove a day at the end of a trip.
 *
 * Contract (parity spec Gap 8): the web Server Actions `addTripDayAction` /
 * `removeTripDayAction` are mirrored by extending `PATCH /api/trips/:id` to
 * accept `{ addDay: true }` / `{ removeDay: true }` (remove keeps the
 * places-to-Saved semantics, so we must NOT emulate it with endDate math
 * client-side). Lives here (not lib/api) because lib/** is owned elsewhere.
 *
 * Guard: a backend that doesn't support the flag yet silently ignores unknown
 * PATCH fields and returns the unchanged trip — detect that (endDate did not
 * move) and throw so the UI shows "Couldn't save" instead of a false "Saved ✓".
 */
import { writeJson } from '../../lib/api/client';
import type { Trip } from '../../lib/api';

async function patchDay(tripId: string, body: { addDay: true } | { removeDay: true }, currentEndDate: string): Promise<Trip> {
  const { trip } = await writeJson<{ trip: Trip }>('PATCH', `/api/trips/${tripId}`, body);
  if (trip.endDate === currentEndDate) throw new Error('unsupported_patch');
  return trip;
}

/** Append one day to the end of the trip. */
export function addTripDay(tripId: string, currentEndDate: string): Promise<Trip> {
  return patchDay(tripId, { addDay: true }, currentEndDate);
}

/** Drop the last day (server moves that day's places to Saved). */
export function removeTripDay(tripId: string, currentEndDate: string): Promise<Trip> {
  return patchDay(tripId, { removeDay: true }, currentEndDate);
}
