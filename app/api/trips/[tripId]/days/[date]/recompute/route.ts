import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { recomputeDayLegsAction } from '@/app/_actions/places';
import { getPrincipal, requireTripMember } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

const schema = z.object({ mode: z.enum(['walk', 'drive', 'transit']) });

/**
 * Recompute a day's travel legs in the given default mode (per-leg overrides are
 * honored). POST { mode }. Returns the resulting legs. Needs the IP-restricted
 * Google key, so this only produces routes on the prod host.
 */
export async function POST(
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
    const legs = await recomputeDayLegsAction(tripId, date, parsed.data.mode);
    return NextResponse.json({ legs });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_input', message: (err as Error)?.message }, { status: 400 });
  }
}
