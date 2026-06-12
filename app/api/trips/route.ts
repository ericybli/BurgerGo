import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrips, getTripsForUser } from '@/src/db/repos/trips';
import { createTripAction } from '@/app/_actions/trips';
import { restWrite } from '@/src/lib/restWrite';
import { getPrincipal } from '@/src/lib/authz';

export const dynamic = 'force-dynamic';

/** List trips. Machine callers see everything; users only their memberships. */
export async function GET(req: Request) {
  const principal = await getPrincipal(req);
  if (!principal) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const rows =
    principal.kind === 'machine'
      ? getTrips(db, { tz: env.TZ })
      : getTripsForUser(db, principal.userId, { tz: env.TZ });
  return NextResponse.json(rows);
}

/** Create a trip. POST { name, startDate, endDate }. */
export async function POST(req: Request) {
  return restWrite(req, async (body) => ({
    trip: await createTripAction(body as { name: string; startDate: string; endDate: string }),
  }));
}
