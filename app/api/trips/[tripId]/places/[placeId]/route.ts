import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getPlace } from '@/src/db/repos/places';
import { updatePlaceAction, deletePlaceAction } from '@/app/_actions/places';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

/**
 * REST write surface for a single place — used by the native client (the web app
 * mutates via Server Actions). These wrap the same actions, adding auth, trip-
 * ownership, and HTTP error mapping. Requires a principal (session or x-api-key)
 * + trip membership, matching the rest of the write API.
 */

/** Verify the place exists AND belongs to this trip; returns it or null. */
function ownedPlace(tripId: string, placeId: string) {
  const place = getPlace(db, placeId);
  return place && place.tripId === tripId ? place : null;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ tripId: string; placeId: string }> },
) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { tripId, placeId } = await ctx.params;
  try {
    requireTripMember(principal, tripId);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!ownedPlace(tripId, placeId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  try {
    // updatePlaceAction validates the patch (zod) and invalidates touched legs.
    const place = await updatePlaceAction(placeId, body as Parameters<typeof updatePlaceAction>[1]);
    return NextResponse.json({ place });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_input', message: (err as Error)?.message ?? 'invalid' },
      { status: 400 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ tripId: string; placeId: string }> },
) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { tripId, placeId } = await ctx.params;
  try {
    requireTripMember(principal, tripId);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!ownedPlace(tripId, placeId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  await deletePlaceAction(placeId);
  return NextResponse.json({ ok: true });
}
