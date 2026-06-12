import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getPlace } from '@/src/db/repos/places';
import { setPlaceListAction } from '@/app/_actions/places';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  /** Target list id, or null to move the place out of any list ("loose"). */
  listId: z.string().min(1).nullable(),
});

/** Move a saved place into / out of a list. PUT { listId: string | null } → { place }. */
export async function PUT(
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
  const existing = getPlace(db, placeId);
  if (!existing || existing.tripId !== tripId) {
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
  try {
    const place = await setPlaceListAction(placeId, parsed.data.listId);
    return NextResponse.json({ place });
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_input', message: (err as Error)?.message ?? 'invalid' },
      { status: 400 },
    );
  }
}
