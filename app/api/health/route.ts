import { NextResponse } from 'next/server';
import { sqlite } from '@/src/db/client';

export const dynamic = 'force-dynamic';

export function GET() {
  // Trivial liveness probe against SQLite (used by the compose healthcheck).
  sqlite.prepare('SELECT 1').get();
  return NextResponse.json({ status: 'ok' });
}
