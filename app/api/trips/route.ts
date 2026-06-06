import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { env } from '@/src/env';
import { getTrips } from '@/src/db/repos/trips';

export const dynamic = 'force-dynamic';

export function GET() {
  const rows = getTrips(db, { tz: env.TZ });
  return NextResponse.json(rows);
}
