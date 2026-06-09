import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrips } from '@/src/db/repos/trips';
import { createTripAction } from '@/app/_actions/trips';
import { restWrite } from '@/src/lib/restWrite';

export const dynamic = 'force-dynamic';

export function GET() {
  const rows = getTrips(db, { tz: env.TZ });
  return NextResponse.json(rows);
}

/** Create a trip. POST { name, startDate, endDate }. */
export async function POST(req: Request) {
  return restWrite(req, async (body) => ({
    trip: await createTripAction(body as { name: string; startDate: string; endDate: string }),
  }));
}
