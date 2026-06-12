import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { setDayTitleAction } from '@/app/_actions/places';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

const schema = z.object({ title: z.string().max(200).nullable() });

/** Set or clear a day's itinerary title. PUT { title: string | null } — empty/null clears. */
export async function PUT(
  req: Request,
  ctx: { params: Promise<{ tripId: string; date: string }> },
) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { tripId, date } = await ctx.params;
  try {
    requireTripMember(principal, tripId);
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!getTrip(db, tripId)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    await setDayTitleAction(tripId, date, parsed.data.title);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_input', message: (err as Error)?.message }, { status: 400 });
  }
}
