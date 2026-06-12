import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { listMembers } from '@/src/db/repos/tripMembers';
import { deriveDays } from '@/src/lib/days';
import {
  renameTripAction,
  shiftTripDatesAction,
  setTripCoverAction,
  addTripDayAction,
  removeTripDayAction,
  deleteTripAction,
} from '@/app/_actions/trips';
import { restWrite } from '@/src/lib/restWrite';
import { restRead } from '@/src/lib/restRead';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  return restRead(req, tripId, () => {
    const trip = getTrip(db, tripId);
    if (!trip) throw new Error('Trip not found');
    const days = deriveDays(trip, env.TZ);
    return { trip, days };
  });
}

/**
 * Update a trip. PATCH may carry any of:
 *   { name }                  → rename
 *   { startDate }             → shift the whole window (length preserved)
 *   { coverPhoto: string|null} → set / clear the cover photo
 *   { addDay: true }          → extend the trip by one day at the end
 *   { removeDay: true }       → drop the last day (its places move to Saved)
 * Each present field is applied via its matching Server Action; the returned
 * `trip` reflects the final state (incl. the updated endDate for add/removeDay).
 * addDay and removeDay are mutually exclusive.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(
    req,
    async (body) => {
      const patch = (body ?? {}) as {
        name?: string;
        startDate?: string;
        coverPhoto?: string | null;
        addDay?: boolean;
        removeDay?: boolean;
      };
      if (patch.addDay && patch.removeDay) {
        throw new Error('addDay and removeDay cannot be combined');
      }
      let trip = getTrip(db, tripId);
      if (!trip) throw new Error('Trip not found');
      if (patch.name !== undefined) trip = await renameTripAction(tripId, patch.name);
      if (patch.startDate !== undefined) trip = await shiftTripDatesAction(tripId, patch.startDate);
      if (patch.coverPhoto !== undefined) trip = await setTripCoverAction(tripId, patch.coverPhoto);
      if (patch.addDay) trip = await addTripDayAction(tripId);
      if (patch.removeDay) trip = await removeTripDayAction(tripId);
      return { trip };
    },
    { tripId },
  );
}

/** Delete a trip. Machine callers may always; users must hold the owner role. */
export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(
    req,
    async (_body, principal) => {
      if (!getTrip(db, tripId)) throw new Error('Trip not found');
      if (principal.kind === 'user') {
        const me = listMembers(db, tripId).find((m) => m.userId === principal.userId);
        if (me?.role !== 'owner') throw new Error('Only the owner can delete the trip');
      }
      await deleteTripAction(tripId);
    },
    { tripId },
  );
}
