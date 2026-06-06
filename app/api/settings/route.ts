import { NextResponse } from 'next/server';
import { db } from '@/src/db/client';
import { getSettings } from '@/src/db/repos/settings';

export const dynamic = 'force-dynamic';

// Read handler for the offline-cacheable settings row. `force-dynamic` is fine
// here: API routes are *fetched* by the client (and SWR-cached by the SW), never
// navigated — so no-store on the JSON response does not block offline reads.
export function GET() {
  const settings = getSettings(db); // getSettings is synchronous
  // Coalesce undefined → null so the client always receives parseable JSON.
  return NextResponse.json(settings ?? null);
}
