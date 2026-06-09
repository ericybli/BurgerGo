import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrip } from '@/src/db/repos/trips';
import { deriveDays } from '@/src/lib/days';
import {
  renameTripAction,
  shiftTripDatesAction,
  setTripCoverAction,
  deleteTripAction,
} from '@/app/_actions/trips';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await ctx.params;
  const trip = getTrip(db, tripId);
  if (!trip) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const days = deriveDays(trip, env.TZ);
  return NextResponse.json({ trip, days });
}

/**
 * Update a trip. PATCH may carry any of:
 *   { name }                  → rename
 *   { startDate }             → shift the whole window (length preserved)
 *   { coverPhoto: string|null} → set / clear the cover photo
 * Each present field is applied via its matching Server Action; the returned
 * `trip` reflects the final state.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async (body) => {
    const patch = (body ?? {}) as {
      name?: string;
      startDate?: string;
      coverPhoto?: string | null;
    };
    let trip = getTrip(db, tripId);
    if (!trip) throw new Error('Trip not found');
    if (patch.name !== undefined) trip = await renameTripAction(tripId, patch.name);
    if (patch.startDate !== undefined) trip = await shiftTripDatesAction(tripId, patch.startDate);
    if (patch.coverPhoto !== undefined) trip = await setTripCoverAction(tripId, patch.coverPhoto);
    return { trip };
  });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await ctx.params;
  return restWrite(req, async () => {
    await deleteTripAction(tripId);
  });
}
