import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/src/db/client';
import { getTrip } from '@/src/db/repos/trips';
import { reorderDayAction } from '@/app/_actions/places';
import { isWriteAuthorized } from '@/src/lib/apiKey';

export const dynamic = 'force-dynamic';

const schema = z.object({ orderedIds: z.array(z.string().min(1)) });

/** Reorder a day's stops. POST { orderedIds: string[] } — the full ordered id list. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ tripId: string; date: string }> },
) {
  if (!isWriteAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { tripId, date } = await ctx.params;
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
    await reorderDayAction(tripId, date, parsed.data.orderedIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'invalid_input', message: (err as Error)?.message }, { status: 400 });
  }
}
