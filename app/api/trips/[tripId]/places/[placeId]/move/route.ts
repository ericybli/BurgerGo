import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getPlace } from '@/src/db/repos/places';
import { promoteToDayAction, copyPlaceToDayAction, moveToSavedAction } from '@/app/_actions/places';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Target day (YYYY-MM-DD), or null to move the place to the Saved bucket. */
  dayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  /** When true (with a dayDate), duplicate onto the day instead of moving. */
  copy: z.boolean().optional(),
});

/**
 * Move a place: to a day (promote), duplicate onto a day (copy), or to the Saved
 * bucket (dayDate=null). Wraps the matching Server Actions, which recompute/clean
 * up legs as needed.
 */
export async function POST(
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
  const place = getPlace(db, placeId);
  if (!place || place.tripId !== tripId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  const { dayDate, copy } = parsed.data;

  try {
    if (dayDate === null) {
      return NextResponse.json({ place: await moveToSavedAction(placeId) });
    }
    const place2 = copy
      ? await copyPlaceToDayAction(placeId, dayDate)
      : await promoteToDayAction(placeId, dayDate);
    return NextResponse.json({ place: place2 });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_input', message: (err as Error)?.message ?? 'invalid' },
      { status: 400 },
    );
  }
}
